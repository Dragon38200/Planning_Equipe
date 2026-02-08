// components/MapView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Mission, User } from '../types';
import { MapPin, X, Calendar, Clock, User as UserIcon, Briefcase } from 'lucide-react';

interface MapViewProps {
  missions: Mission[];
  users: User[];
  onSelectMission?: (mission: Mission) => void;
}

// Déclaration globale pour Google Maps
declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const MapView: React.FC<MapViewProps> = ({ missions, users, onSelectMission }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Charger Google Maps API
  useEffect(() => {
    if (window.google) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBZbtDBtT4Wq5_Af5nXdy7nExCzVGneDuo&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setIsLoaded(true);
    };
    
    script.onerror = () => {
      setLoadError(true);
      console.error('Erreur de chargement de Google Maps');
    };

    document.head.appendChild(script);

    return () => {
      // Nettoyage si nécessaire
    };
  }, []);

  // Initialiser la carte
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    const googleMap = new window.google.maps.Map(mapRef.current, {
      center: { lat: 45.764043, lng: 4.835659 }, // Lyon par défaut
      zoom: 10,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });

    setMap(googleMap);
  }, [isLoaded, map]);

  // Ajouter les marqueurs
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Supprimer les anciens marqueurs
    markers.forEach(marker => marker.setMap(null));

    // Filtrer les missions avec coordonnées ou adresse
    const missionsWithLocation = missions.filter(m => 
      (m.latitude && m.longitude) || m.address
    );

    if (missionsWithLocation.length === 0) {
      console.log('Aucune mission avec localisation');
      return;
    }

    const newMarkers: any[] = [];
    const bounds = new window.google.maps.LatLngBounds();
    const geocoder = new window.google.maps.Geocoder();

    // Fonction pour ajouter un marqueur
    const addMarker = (mission: Mission, lat: number, lng: number) => {
      const technician = users.find(u => u.id === mission.technicianId);
      
      // Couleur selon le statut
      let markerColor = '#6366f1'; // indigo par défaut
      if (mission.status === 'VALIDATED') markerColor = '#10b981'; // vert
      if (mission.status === 'REJECTED') markerColor = '#ef4444'; // rouge
      if (mission.status === 'PENDING') markerColor = '#f59e0b'; // orange

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: `${mission.jobNumber} - ${technician?.name || 'N/A'}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: markerColor,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        animation: window.google.maps.Animation.DROP,
      });

      marker.addListener('click', () => {
        setSelectedMission(mission);
        if (onSelectMission) onSelectMission(mission);
      });

      newMarkers.push(marker);
      bounds.extend({ lat, lng });
    };

    // Traiter chaque mission
    let processedCount = 0;
    missionsWithLocation.forEach((mission) => {
      if (mission.latitude && mission.longitude) {
        // Coordonnées déjà disponibles
        addMarker(mission, mission.latitude, mission.longitude);
        processedCount++;
        
        if (processedCount === missionsWithLocation.length) {
          map.fitBounds(bounds);
          if (missionsWithLocation.length === 1) {
            map.setZoom(15);
          }
        }
      } else if (mission.address) {
        // Géocoder l'adresse
        geocoder.geocode({ address: mission.address }, (results: any, status: any) => {
          if (status === 'OK' && results[0]) {
            const lat = results[0].geometry.location.lat();
            const lng = results[0].geometry.location.lng();
            addMarker(mission, lat, lng);
          }
          
          processedCount++;
          if (processedCount === missionsWithLocation.length) {
            map.fitBounds(bounds);
            if (missionsWithLocation.length === 1) {
              map.setZoom(15);
            }
          }
        });
      }
    });

    setMarkers(newMarkers);
  }, [map, missions, users, isLoaded]);

  const getTechnicianName = (technicianId: string) => {
    return users.find(u => u.id === technicianId)?.name || 'Inconnu';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      SUBMITTED: 'Soumis',
      VALIDATED: 'Validé',
      REJECTED: 'Rejeté',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200',
      VALIDATED: 'bg-green-100 text-green-800 border-green-200',
      REJECTED: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 rounded-2xl border-2 border-slate-200">
        <div className="text-center p-8">
          <MapPin size={48} className="mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">Erreur de chargement</h3>
          <p className="text-sm text-slate-500">Impossible de charger Google Maps. Vérifiez votre connexion internet.</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 rounded-2xl border-2 border-slate-200">
        <div className="text-center p-8">
          <MapPin size={48} className="mx-auto text-indigo-400 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">Chargement de la carte...</h3>
          <p className="text-sm text-slate-500">Veuillez patienter</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Carte Google Maps */}
      <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden border-2 border-slate-200" />

      {/* Légende */}
      <div className="absolute top-4 right-4 bg-white rounded-xl shadow-lg p-4 border-2 border-slate-200">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Légende</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-white"></div>
            <span className="text-xs font-bold text-slate-600">En attente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-white"></div>
            <span className="text-xs font-bold text-slate-600">Soumis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
            <span className="text-xs font-bold text-slate-600">Validé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white"></div>
            <span className="text-xs font-bold text-slate-600">Rejeté</span>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg p-4 border-2 border-slate-200">
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-indigo-600" />
          <span className="text-sm font-black text-slate-700">
            {missions.filter(m => m.latitude || m.address).length} interventions localisées
          </span>
        </div>
      </div>

      {/* Popup de détails de mission */}
      {selectedMission && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-2xl shadow-2xl p-6 border-2 border-slate-200 w-96 animate-in slide-in-from-bottom">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
                {selectedMission.jobNumber}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {getTechnicianName(selectedMission.technicianId)}
              </p>
            </div>
            <button
              onClick={() => setSelectedMission(null)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={16} className="text-slate-400" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={16} className="text-slate-400" />
              <span className="font-bold text-slate-700">
                {new Date(selectedMission.date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-slate-400" />
              <span className="font-bold text-slate-700">
                {selectedMission.workHours}h travail • {selectedMission.travelHours}h trajet
              </span>
            </div>

            {selectedMission.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <span className="font-bold text-slate-700">{selectedMission.address}</span>
              </div>
            )}

            {selectedMission.description && (
              <div className="flex items-start gap-2 text-sm">
                <Briefcase size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <span className="text-slate-600">{selectedMission.description}</span>
              </div>
            )}

            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border-2 ${getStatusColor(selectedMission.status)}`}>
              {getStatusLabel(selectedMission.status)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
