from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import config

# Create FastAPI
app = FastAPI(title="TYTO API", description="API for TYTO weather station")

app.mount("/static", StaticFiles(directory="static"), name="static")

# Define data model
class SensorData(BaseModel):
    temperature: float
    humidity: float
    pressure: float


# Connect to InfluxDB
client = InfluxDBClient(url=config.INFLUXDB_URL, token=config.INFLUXDB_TOKEN, org=config.INFLUXDB_ORG)
write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()

# Create route to receive data
@app.post("/api/measurements")
def add_measurement(data: SensorData):
    try:
        # Create InfluxDB points
        point = Point("environment") \
            .field("temperature", data.temperature) \
            .field("humidity", data.humidity) \
            .field("pressure", data.pressure)

        # Write in database
        write_api.write(bucket=config.INFLUXDB_BUCKET, org=config.INFLUXDB_ORG, record=point)

        return {"status": "success", "message": "Data saved successfullly"}

    except Exception as e:
        # 500 if error
        raise HTTPException(status_code=500, detail=str(e))

# Create route to read data in last hours
@app.get("/api/measurements")
def get_measurements(hours: int = 24):
    try:
        query = f"""
            from(bucket: "{config.INFLUXDB_BUCKET}")
            |> range(start: -{hours}h)
            |> filter(fn: (r) => r["_measurement"] == "environment")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        """

        tables = query_api.query(query, org=config.INFLUXDB_ORG)

        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "time": record.get_time().isoformat(),
                    "temperature": record.values.get("temperature"),
                    "humidity": record.values.get("humidity"),
                    "pressure": record.values.get("pressure")
                })

        return results

    except Exception as e:
        # 500 if error
        raise HTTPException(status_code=500, detail=str(e))

# Create route to read data in days, aggregated by hour
@app.get("/api/measurements/history")
def get_historical_measurements(days: int = 7):
    try:
        query = f"""
            from(bucket: "{config.INFLUXDB_BUCKET}")
            |> range(start: -{days}d)
            |> filter(fn: (r) => r["_measurement"] == "environment")
            |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        """

        tables = query_api.query(query, org=config.INFLUXDB_ORG)

        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "time": record.get_time().isoformat(),
                    "temperature": round(record.values.get("temperature"), 2),
                    "humidity": round(record.values.get("humidity"), 2),
                    "pressure": round(record.values.get("pressure"), 2)
                })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create route to get the mean in the last hours
@app.get("/api/measurements/average")
def get_average(hours: int = 24):
    try:
        query = f"""
            from(bucket: "{config.INFLUXDB_BUCKET}")
            |> range(start: -{hours}h)
            |> filter(fn: (r) => r["_measurement"] == "environment")
            |> mean()
        """

        tables = query_api.query(query, org=config.INFLUXDB_ORG)

        averages = {}
        for table in tables:
            for record in table.records:
                field = record.get_field()
                averages[field] = round(record.get_value(), 2)

        return averages
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create route to get the min in the last hours
@app.get("/api/measurements/min")
def get_min(hours: int = 24):
    try:
        query = f"""
            from(bucket: "{config.INFLUXDB_BUCKET}")
            |> range(start: -{hours}h)
            |> filter(fn: (r) => r["_measurement"] == "environment")
            |> min()
        """

        tables = query_api.query(query, org=config.INFLUXDB_ORG)

        mins = {}
        for table in tables:
            for record in table.records:
                field = record.get_field()
                mins[field] = round(record.get_value(), 2)

        return mins
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create route to get the max in the last hours
@app.get("/api/measurements/max")
def get_max(hours: int = 24):
    try:
        query = f"""
            from(bucket: "{config.INFLUXDB_BUCKET}")
            |> range(start: -{hours}h)
            |> filter(fn: (r) => r["_measurement"] == "environment")
            |> max()
        """

        tables = query_api.query(query, org=config.INFLUXDB_ORG)

        maxs = {}
        for table in tables:
            for record in table.records:
                field = record.get_field()
                maxs[field] = round(record.get_value(), 2)

        return maxs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create route to display dashboard
@app.get("/dashboard")
def get_dashboard():
    return FileResponse("static/index.html")