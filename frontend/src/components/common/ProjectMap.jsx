// ============================================================
// BUROOJ HEIGHTS ERP — PROJECT LOCATION MAP
// Uses Google Maps Embed API (no billing for basic embed)
// ============================================================
import React, { useState } from 'react';
import { MapPin, ExternalLink, Map } from 'lucide-react';

const BUROOJ_LOCATION = {
  lat:     31.3984,
  lng:     74.1387,
  address: 'Main Boulevard Dream Housing, Raiwind Road, Lahore',
  name:    'Burooj Heights',
  mapsUrl: 'https://maps.google.com/?q=Burooj+Heights+Dream+Housing+Raiwind+Road+Lahore',
};

export default function ProjectMap({ apiKey, compact = false }) {
  const [mapError, setMapError] = useState(false);

  // Build embed URL
  const buildEmbedUrl = () => {
    const query = encodeURIComponent(BUROOJ_LOCATION.address + ', Lahore');
    if (apiKey) {
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}&zoom=16`;
    }
    // Fallback: no-key embed (limited but functional)
    return `https://maps.google.com/maps?q=${query}&z=16&output=embed`;
  };

  if (compact) {
    return (
      <a
        href={BUROOJ_LOCATION.mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 text-sm text-[#0098B4] hover:text-[#007A91] transition group"
      >
        <MapPin size={15} className="group-hover:scale-110 transition" />
        <span className="truncate">{BUROOJ_LOCATION.address}</span>
        <ExternalLink size={12} className="flex-shrink-0" />
      </a>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#0098B4]/10 rounded-lg flex items-center justify-center">
            <Map size={16} className="text-[#0098B4]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{BUROOJ_LOCATION.name}</h3>
            <p className="text-xs text-gray-400">{BUROOJ_LOCATION.address}</p>
          </div>
        </div>
        <a
          href={BUROOJ_LOCATION.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#0098B4] hover:text-[#007A91] transition font-medium"
        >
          Open in Maps <ExternalLink size={12} />
        </a>
      </div>

      {/* Map */}
      <div className="relative" style={{ height: 280 }}>
        {mapError ? (
          <div className="absolute inset-0 bg-gray-50 flex flex-col items-center justify-center gap-3">
            <MapPin size={32} className="text-gray-300" />
            <div className="text-center">
              <p className="text-sm text-gray-500 font-medium">Map unavailable</p>
              <p className="text-xs text-gray-400 mt-1">{BUROOJ_LOCATION.address}</p>
            </div>
            <a
              href={BUROOJ_LOCATION.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0098B4] text-white rounded-lg text-xs font-medium hover:bg-[#007A91] transition"
            >
              View on Google Maps <ExternalLink size={11} />
            </a>
          </div>
        ) : (
          <iframe
            title="Burooj Heights Location"
            src={buildEmbedUrl()}
            width="100%"
            height="280"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onError={() => setMapError(true)}
          />
        )}
      </div>
    </div>
  );
}
