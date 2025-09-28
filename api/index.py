
from flask import Flask, request, jsonify, Response
import pandas as pd
from datetime import datetime, timedelta
from flask_cors import CORS
import numpy as np
import pickle
import requests  
import os
import io
from dotenv import load_dotenv
from google import genai
from google.genai import types

# testing

import onnxruntime as rt

# --- App Initialization ---
app = Flask(__name__, static_folder='../public', static_url_path='')
CORS(app)
load_dotenv()


@app.route("/")
def index():
    return app.send_static_file('index.html')


# --- NEW: Get the Geospatial Service URL from Environment Variables ---
GEOSPATIAL_API_URL = os.getenv("GEOSPATIAL_API_URL")
# Get the URLs from the environment variables
# MODEL_URL = os.getenv("MODEL_BLOB_URL")
SCALER_URL = os.getenv("SCALER_BLOB_URL")
ONNX_MODEL_URL = os.getenv("ONNX_MODEL_BLOB_URL")

# MODIFIED get_location_data to now integrate with google run
@app.route("/api/get_location_data", methods=["GET"])
def get_location_data():
    print("HRLLWOEW")
    latitude = request.args.get("lat", type=float)
    longitude = request.args.get("lon", type=float)

    if latitude is None or longitude is None or not GEOSPATIAL_API_URL:
        error_msg = "Invalid coordinates or geospatial service URL is not configured."
        return jsonify({"error": error_msg}), 400

    try:
        print("TRY AND PRINT")
        # This is the API call to your Google Cloud Run service
        response = requests.get(
            GEOSPATIAL_API_URL + "/get_geo_data", # Make sure to add the path
            params={"lat": latitude, "lon": longitude},
            timeout=15 
        )
        response.raise_for_status() # Raise an error for bad responses (like 404 or 500)
        
        # Return the JSON data from the geospatial service directly to the frontend
        return response.json()

    except requests.exceptions.RequestException as e:
        print(f"Error calling geospatial service: {e}")
        return jsonify({"error": "Failed to retrieve location data from the geospatial service."}), 503


# =========================================================================
# == MODIFIED: Fetch weather data to accept time and generate chart data ==
# =========================================================================
def fetch_weather_data(latitude, longitude, end_date_str, end_time_str):
    try:
        # Combine date and time for a precise endpoint
        end_datetime = datetime.strptime(
            f"{end_date_str} {end_time_str}", "%Y-%m-%d %H:%M"
        )

        # Fetch data for the last 6 days to ensure all windows are covered
        api_start_date = end_datetime - timedelta(days=6)
        api_end_date = end_datetime

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": "precipitation,soil_moisture_27_to_81cm",
            "start_date": api_start_date.strftime("%Y-%m-%d"),
            "end_date": api_end_date.strftime("%Y-%m-%d"),
            "timezone": "auto",
            "forecast_days": 0,
            "precipitation_unit": "inch",
        }

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        hourly_data = data.get("hourly", {})
        df = pd.DataFrame(
            {
                "timestamp": pd.to_datetime(hourly_data["time"]),
                "rain_mm": np.array(hourly_data["precipitation"]),
                "soil_moisture": np.array(hourly_data["soil_moisture_27_to_81cm"]),
            }
        ).fillna(0.0)

        # Filter to only include data up to the user's selected end_datetime
        df = df[df["timestamp"] <= end_datetime].copy()
        if df.empty:
            return {"error": "No historical data available for the selected time."}

        # --- Calculations for the prediction model ---
        def compute_cumulative(hours):
            start_time = end_datetime - timedelta(hours=hours)
            mask = (df["timestamp"] > start_time) & (df["timestamp"] <= end_datetime)
            return float(df.loc[mask, "rain_mm"].sum())

        def compute_intensity(hours):
            cumulative = compute_cumulative(hours)
            return float(cumulative / hours) if hours > 0 else 0.0

        time_windows = {
            "3_hr": 3,
            "6_hr": 6,
            "12_hr": 12,
            "1_day": 24,
            "3_day": 72,
            "5_day": 120,
        }
        cumulative_rainfall = {
            label: compute_cumulative(h) for label, h in time_windows.items()
        }
        rain_intensity = {
            label: compute_intensity(h) for label, h in time_windows.items()
        }

        # --- NEW & CORRECTED: Generate clean data specifically for the 4 charts ---

        # 1. Hourly Chart Data (for the 12 hours leading up to end_datetime)
        hourly_chart_data = []
        # Get the last 12 data points from our filtered dataframe
        last_12_hours_df = df.tail(12)

        running_cumulative = 0
        for index, row in last_12_hours_df.iterrows():
            running_cumulative += row["rain_mm"]
            hourly_chart_data.append(
                {
                    "hour": row["timestamp"].strftime("%H:00"),
                    "cumulative": running_cumulative,  # A true running total over the 12hr window
                    "intensity": row[
                        "rain_mm"
                    ],  # The intensity is just the rainfall for that single hour
                }
            )

        # 2. Daily Chart Data (for the 5 days leading up to end_date)
        daily_df = df[
            df["timestamp"]
            >= end_datetime.replace(hour=0, minute=0, second=0) - timedelta(days=4)
        ].copy()
        daily_summary = (
            daily_df.groupby(daily_df["timestamp"].dt.date)
            .agg(
                daily_cumulative=("rain_mm", "sum"),
                # The average intensity for a day is the total rain divided by 24 hours
                daily_avg_intensity=("rain_mm", lambda x: x.sum() / 24),
            )
            .reset_index()
        )

        daily_chart_data = [
            {
                "date": row["timestamp"].strftime("%b %d"),
                "cumulative": float(row["daily_cumulative"]),
                "intensity": float(row["daily_avg_intensity"]),
            }
            for _, row in daily_summary.iterrows()
        ]

        return {
            "soil_moisture": float(df["soil_moisture"].iloc[-1]),
            "cumulative_rainfall": cumulative_rainfall,
            "rain_intensity": rain_intensity,
            "hourly_chart_data": hourly_chart_data,
            "daily_chart_data": daily_chart_data,
        }

    except Exception as e:
        print(f"Error processing weather data: {e}")
        return {"error": f"Error processing weather data: {e}"}


# ... (rest of the search_locations, get_weather endpoint handler, predict endpoint handler, model loading, main execution block) ...


@app.route("/api/search_locations", methods=["GET"])
def search_locations():
    query = request.args.get("query")
    if not query:
        return jsonify({"error": "Missing query parameter"}), 400

    # Added a minimum query length for efficiency and relevance
    if len(query.strip()) < 3:
        return jsonify({"suggestions": []})  # Return empty list for short queries

    # Add a User-Agent header as recommended by Nominatim
    query = request.args.get("query")  # This line likely exists already
    url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1&countrycodes=PH"

    headers = {"User-Agent": "Two-Step-Ahead (eriksonss1535@gmail.com)"}
    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        print(f"Error fetching Nominatim data: Status {response.status_code}")
        return (
            jsonify({"error": "Failed to fetch location data from Nominatim"}),
            response.status_code,
        )

    data = response.json()

    # Debugging output
    print("Nominatim Query:", query)
    print("Nominatim Response (first 5):", data[:1])  # Print only first few for brevity

    if not data:
        print("No results found for Nominatim query:", query)
        return jsonify({"suggestions": []})  # Return empty list if no results

    locations = []
    for item in data:
        # **Crucially: ONLY extract and return basic info from Nominatim**
        # **DO NOT call get_soil_type, get_slope, or fetch_weather_data here**
        locations.append(
            {
                "name": item.get("display_name", "Unnamed Location"),
                "lat": item.get("lat"),
                "lon": item.get("lon"),
                # Add other useful Nominatim fields if needed, but avoid fetching external data
                "category": item.get("category"),
                "type": item.get("type"),
            }
        )

    print(f"Returning {len(locations)} search suggestions.")
    return jsonify({"suggestions": locations})


# ==========================================================
# == MODIFIED: /get_weather endpoint to accept time param ==
# ==========================================================
@app.route("/api/get_weather", methods=["GET"])
def get_weather():
    latitude = request.args.get("latitude", type=float)
    longitude = request.args.get("longitude", type=float)
    date = request.args.get("date", type=str)
    # Get time, with a default of 23:59 if not provided
    time = request.args.get("time", "23:59")

    if not all([latitude, longitude, date, time]):
        return jsonify({"error": "Missing required parameters"}), 400

    data = fetch_weather_data(latitude, longitude, date, time)
    return jsonify(data)


# --- MODIFIED load_from_url with DETAILED LOGGING ---
def load_from_url(url):
    """Downloads a file from a URL and returns its content."""
    print(f"--- Attempting to download from URL: {url} ---") # DEBUG PRINT 1
    if not url:
        raise ValueError("URL is None or empty. Check environment variables.")
    try:
        response = requests.get(url, timeout=30)
        print(f"--- Download request completed with status code: {response.status_code} ---") # DEBUG PRINT 2
        response.raise_for_status() # This will raise an error for 4xx/5xx status codes
        print(f"--- File downloaded successfully. Size: {len(response.content)} bytes. ---") # DEBUG PRINT 3
        return response.content
    except requests.exceptions.RequestException as e:
        print(f"--- FATAL ERROR during download from {url}: {e} ---") # DEBUG PRINT (ERROR)
        raise

# --- MODIFIED Model Loading with DETAILED LOGGING ---
try:
    print("LAST")
    print("--- Starting model loading process... ---")
    model_content = load_from_url(ONNX_MODEL_URL)
    
    print("--- Creating ONNX inference session... ---")
    sess_options = rt.SessionOptions()
    model = rt.InferenceSession(model_content, sess_options, providers=['CPUExecutionProvider'])
    print("--- ONNX model session created successfully. Application is ready. ---")

except Exception as e:
    print(f"--- FATAL ERROR: Could not load models. Application cannot start. Error: {e} ---")
    raise


@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        data = request.json
        features = np.array([
            int(data.get("soil_type", 0)),
            float(data.get("slope", 0)),
            float(data.get("soil_moisture", 0)),
            float(data.get("rainfall-3-hr", 0)),
            float(data.get("rainfall-6-hr", 0)),
            float(data.get("rainfall-12-hr", 0)),
            float(data.get("rain-intensity-3-hr", 0)),
            float(data.get("rain-intensity-6hr", 0)),
            float(data.get("rain-intensity-12-hr", 0)),
            float(data.get("rainfall-1-day", 0)),
            float(data.get("rainfall-3-day", 0)),
            float(data.get("rainfall-5-day", 0)),
            float(data.get("rain-intensity-1-day", 0)),
            float(data.get("rain-intensity-3-day", 0)),
            float(data.get("rain-intensity-5-day", 0)),
        ], dtype=np.float32)

        # features_scaled = scaler.transform([features])


         # --- Prediction using ONNX Runtime ---
        # Get the name of the input node
        input_name = model.get_inputs()[0].name
        # Get the names of the output nodes (usually 2: label and probabilities)
        label_name = model.get_outputs()[0].name
        probability_name = model.get_outputs()[1].name

        # Run inference
        # Note the input format: a dictionary mapping input_name to the scaled features
        pred_onx = model.run([label_name, probability_name], {input_name: features})

        probabilities = pred_onx[1][0] # The probabilities are in the second output
        prediction = int(np.argmax(probabilities))

        print(f"Scaled Features: {features}")
        print(f"Probabilities: {probabilities}")

        return jsonify(
            {
                "prediction": "Landslide" if prediction == 1 else "No Landslide",
                "confidence": f"{max(probabilities) * 100:.2f}%",
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ==========================================================
# == CODE for the Generate AI Report ==
# ==========================================================


# In order to use this properly you need to first:
# 1. Have an api key for the gemini model (you can use mine but I recommend you have you own so that mine doesn't reach the rate limit. AIzaSyB-rg3sokaltFw2IHB8eiR1hbjNFaGxMpQ )
# 2. create a ' .env ' file and the content should be ' GEMINI_API_KEY="your_api_key" '
# 3. the .env file and the server.py file should be in the same directory/within the same folder
# 4. It should now work but if it doesn't make sure to save everything and reload you work

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# === ENDPOINT 2: NEW GEMINI REPORT GENERATOR ===
@app.route("/api/generate_report", methods=["POST"])  # <-- NEW, SEPARATE URL
def generate_report():
    """
    Receives data and uses Gemini to generate a detailed text report.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data received"}), 400
        print("Received data for GEMINI report:", data)

        response = client.models.generate_content_stream(
            model="gemini-2.5-flash",
            
            contents=f"""
            Generate a comprehensive risk assessment report for a potential landslide.
            The report should be structured, professional, and easy for a non-expert to understand.
            Your analysis should consider all the environmental data provided below.
            Conclude with a clear risk level (e.g., Low, Moderate, High, Critical) and a list of actionable recommendations for Local Government Units (LGUs) and residents.
            
            ---
            **DISCLAIMER:**
            This report is based on the available data and predictive models. Ground conditions can change rapidly. Furthermore, this report was made using the gemini model. This assessment should be used as a guide for disaster preparedness and mitigation and not as a substitute for on-site engineering and geological assessments.

            ---
            **INCIDENT AND ASSESSMENT OVERVIEW:**
            - **Report Generation Date:** {data.get('date_today', 'N/A')}
            - **Prediction for Date:** {data.get('prediction_date', 'N/A')}
            - **Location:** {data.get('location_name', 'N/A')} 
            - **Coordinates:** (for latitude: {data.get('location_lat', 'N/A')} ) (for longituded {data.get('location_lng', 'N/A')})

            ---
            **INITIAL PREDICTION CONTEXT:**
            - **Initial Model Prediction:** {data.get('original_model_prediction', 'N/A')}
            - **Initial Model Confidence:** {data.get('original_model_confidence', 'N/A')}

            ---
            **GEOLOGICAL AND SITE CHARACTERISTICS:**

            - **Geological Assessment:** [Provide a brief description of the area's geology, e.g., "The area is underlain by [rock formation], which is known for its susceptibility to weathering and erosion."]
            - **Soil Type:** {data.get('soil_type', 'N/A')} 
            - **Slope Angle (degrees):** {data.get('slope', 'N/A')} if the slope is 1 then the slope is less than 10 degress it is 2 the slope value is between 10 to 20 degress if it is 3 then the value is between 20 to 30 degrees if the value is 4 then the value is between 30 to 40 degress if it is 5 then the value is 40 to 50 degress if it is 6 then the value is more than 50 degrees
 

            ---
            **HYDRO-METEOROLOGICAL DATA:**

            **CUMULATIVE RAINFALL (mm):**
            - **Last 3 hours:** {data.get('rainfall-3_hr', 'N/A')}
            - **Last 6 hours:** {data.get('rainfall-6_hr', 'N/A')}
            - **Last 12 hours:** {data.get('rainfall-12_hr', 'N/A')}
            - **Last 1 day:** {data.get('rainfall-1-day', 'N/A')}
            - **Last 3 days:** {data.get('rainfall-3-day', 'N/A')}
            - **Last 5 days:** {data.get('rainfall-5-day', 'N/A')}

            **RAINFALL INTENSITY (mm/hr):**
            - **Average over last 3 hours:** {data.get('rain-intensity-3_hr', 'N/A')}
            - **Average over last 6 hours:** {data.get('rain-intensity-6_hr', 'N/A')}
            - **Average over last 12 hours:** {data.get('rain-intensity-12_hr', 'N/A')}
            - **Average over last 1 day:** {data.get('rain-intensity-1-day', 'N/A')}
            - **Average over last 3 days:** {data.get('rain-intensity-3-day', 'N/A')}
            - **Average over last 5 days:** {data.get('rain-intensity-5-day', 'N/A')}

            **SOIL MOISTURE:**
            - **Current Soil Moisture (percentage):** {data.get('soil_moisture', 'N/A')}%

            ---
            **VULNERABILITY AND RISK ASSESSMENT:**

            **Analysis of Landslide Contributing Factors:**
            [This section should synthesize the data above. For example: "The steep slope of {data.get('slope', 'N/A')}, combined with the soil type ({data.get('soil_type', 'N/A')}), makes the area inherently susceptible to landslides. The recent heavy rainfall over the past 3 days ({data.get('rainfall-3-day', 'N/A')} mm) has likely increased soil saturation and pore water pressure, further elevating the risk."]

            **Agreement with Initial Prediction:**
            [Comment on the initial model's prediction. For example: "The initial model's prediction of a {data.get('original_model_prediction', 'N/A')} risk level is consistent with this detailed analysis. The high confidence of {data.get('original_model_confidence', 'N/A')}% is supported by the combination of geological and meteorological factors."]

            ---
            **LANDSLIDE REPORT SUMMARY:**
            **Summary/Conclusion:**
            [Provide a clear and concise summary of the report so far]
            
            ---

            **RECOMMENDATIONS:**

            **For the Local Government Unit (LGU) / Disaster Risk Reduction and Management Office (DRRMO):**
            1.  **Information Dissemination:** Immediately disseminate this warning to the affected barangays and communities.
            2.  **Monitoring:** Continuously monitor rainfall and be alert for signs of impending landslides (e.g., tension cracks, bulging ground, unusual sounds). Observe for rapid increases or decreases in creek/river water levels, which may be accompanied by increased turbidity.
            3.  **Pre-emptive Evacuation:** For areas rated as Highly or Critically susceptible, consider and, if necessary, implement pre-emptive evacuation, especially for residents in the most dangerous areas.
            4.  **Evacuation Centers:** Ensure that designated evacuation centers are ready, accessible, and equipped with necessary supplies.
            5.  **Road Safety:** Monitor road conditions and advise the public of any potential road closures.

            **For Residents and the Community:**
            1.  **Be Vigilant:** Be aware of your surroundings and watch for any signs of land movement.
            2.  **Stay Informed:** Monitor official news and advisories from PAGASA and your local DRRMO.
            3.  **Evacuate if Necessary:** If you are in a high-risk area, be prepared to evacuate immediately when instructed by local authorities.
            4.  **Community-Based Monitoring:** Report any unusual observations to your barangay officials.


            **--- END OF REPORT ---**

            """,
        )

        def stream_generator():
            for stream in response:
                if stream.text:
                    yield stream.text

        return Response(stream_generator(), mimetype="text/plain")
        # return jsonify({"report": response.text})

    except Exception as e:
        print(f"An error occurred in report generation: {e}")
        return (
            jsonify(
                {"error": "An internal error occurred while generating the report."}
            ),
            500,
        )



# THE OLD code for getting the soil and slope now moved to google cloud run
# REMOVE IN THE FUTURE !!!!

# # Load spatial files (assuming these paths are correct relative to where the script is run)
# try:
#     soil_shapefile = "../public/backend/soil map/hays.shp"
#     soil_gdf = gpd.read_file(soil_shapefile)
#     soil_gdf.sindex  # Build spatial index for performance
# except Exception as e:
#     print(f"Error loading soil shapefile {soil_shapefile}: {e}")
#     soil_gdf = None

# try:
#     slope_tif = "../public/backend/Slope Map/slope.tif"
#     # Keep the rasterio file open reference if needed elsewhere, or open/close per call
#     # For simplicity here, we'll open/c1lose inside the function
#     # slope_raster = rasterio.open(slope_tif)
# except Exception as e:
#     print(f"Error loading slope GeoTIFF {slope_tif}: {e}")
#     # slope_raster = None


# # Convert coordinates from WGS84 to raster CRS
# def convert_coords(lon, lat, crs):
#     # You might need pyproj import here if it's not globally available
#     transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
#     return transformer.transform(lon, lat)


# # Function to extract soil type from shapefile
# def get_soil_type(lon, lat):
#     if soil_gdf is None:
#         return "Error: Shapefile not loaded"
#     point = Point(lon, lat)
#     # Add error handling/validation for point
#     if not point.is_valid:
#         return "Error: Invalid coordinates for soil lookup"
#     try:
#         for _, row in soil_gdf.iterrows():
#             # Use .within() or .intersects() with buffering for robustness near boundaries if needed
#             if row.geometry and row.geometry.contains(point):
#                 return row.get("SNUM", "Unknown")  # Use .get for safer attribute access
#         return "Unknown"  # Point not found in any polygon
#     except Exception as e:
#         print(f"Error in get_soil_type: {e}")
#         return "Error during processing"


# # Function to extract slope from GeoTIFF
# def get_slope(lon, lat):
#     # Open the raster inside the function to manage resources
#     try:
#         with rasterio.open(slope_tif) as src:
#             x, y = convert_coords(
#                 lon, lat, src.crs
#             )  # Convert coordinates to raster CRS
#             # Check if coordinates are within raster bounds before indexing
#             if not (
#                 src.bounds.left <= x <= src.bounds.right
#                 and src.bounds.bottom <= y <= src.bounds.top
#             ):
#                 print(
#                     f"Coords ({lon}, {lat}) converted to ({x}, {y}) are outside raster bounds."
#                 )
#                 return None  # Return None if outside bounds

#             row, col = src.index(x, y)  # Get row/col in raster

#             # Check if row/col are within raster dimensions
#             if 0 <= row < src.height and 0 <= col < src.width:
#                 # Read only a single pixel
#                 window = ((row, row + 1), (col, col + 1))
#                 # Use boundless=True to read even if the calculated row/col is slightly off edge (returns nodata if outside padded area)
#                 slope_value_array = src.read(1, window=window, boundless=True)

#                 if slope_value_array.shape == (1, 1):
#                     slope_value = slope_value_array[0, 0]
#                 else:
#                     print("Did not read a single pixel as expected.")
#                     return None

#                 # Handle NoData values or NaNs
#                 if src.nodata is not None and slope_value == src.nodata:
#                     return None  # Return None for NoData
#                 if np.isnan(slope_value):
#                     return None  # Return None for NaN values

#                 return float(slope_value)
#             else:
#                 print(f"Coords ({lon}, {lat}) map to invalid row/col ({row}, {col}).")
#                 return None  # Point maps to invalid row/col index

#     except rasterio.errors.RasterioIOError as e:
#         print(f"Rasterio IO error reading slope data: {e}")
#         return "Error reading raster file"
#     except Exception as e:
#         print(f"Error during slope extraction: {e}")
#         return "Error during processing"


# # Get location data (slope & soil type)
# @app.route("/get_location_data", methods=["GET"])
# def get_location_data():
#     latitude = request.args.get("lat", type=float)
#     longitude = request.args.get("lon", type=float)

#     if (
#         latitude is None
#         or longitude is None
#         or abs(latitude) > 90
#         or abs(longitude) > 180
#     ):
#         return jsonify({"error": "Invalid or missing coordinates"}), 400

#     # Add error handling for spatial file loading issues
#     if (
#         soil_gdf is None or slope_tif is None
#     ):  # Check slope_tif path existence might be better
#         return jsonify({"error": "Spatial data files not loaded on server"}), 500

#     slope = get_slope(longitude, latitude)
#     soil_type = get_soil_type(longitude, latitude)

#     # Return None slope if extraction failed or point was outside
#     return jsonify(
#         {
#             "slope": slope,  # Return None if get_slope returned None or Error string
#             "soil_type": (
#                 str(soil_type)
#                 if not isinstance(soil_type, str) or not soil_type.startswith("Error")
#                 else soil_type
#             ),
#         }
#     )