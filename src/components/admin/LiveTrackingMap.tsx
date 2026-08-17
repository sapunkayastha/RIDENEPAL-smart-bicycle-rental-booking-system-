import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const bikeIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

type Ride = {
  bookingId: string;
  bikeName: string;
  customerName: string;
  lat: number;
  lng: number;
  recordedAt: string;
};

export default function LiveTrackingMap({
  rides,
  center,
}: {
  rides: Ride[];
  center: [number, number];
}) {
  return (
    <MapContainer center={center} zoom={13} style={{ height: "600px", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {rides.map((r) => (
        <Marker key={r.bookingId} position={[r.lat, r.lng]} icon={bikeIcon}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{r.bikeName}</div>
              <div className="text-muted-foreground">{r.customerName}</div>
              <div className="text-xs mt-1">
                Last update: {new Date(r.recordedAt).toLocaleTimeString()}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
