from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import config

# Create FastAPI
app = FastAPI(title="TYTO API", description="API for TYTO weather station")


# Define data model
class SensorData(BaseModel):
    temperature: float
    humidity: float
    pressure: float


# Connect to InfluxDB
client = InfluxDBClient(url=config.INFLUXDB_URL, token=config.INFLUXDB_TOKEN, org=config.INFLUXDB_ORG)
write_api = client.write_api(write_options=SYNCHRONOUS)


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