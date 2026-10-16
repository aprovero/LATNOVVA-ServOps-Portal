import React, { useState } from 'react';
import { MapPin, AlertTriangle, ChevronUp, Info, WifiOff } from 'lucide-react';
import { ResolvedLocationResult } from '../../lib/attendanceV2/locationResolver';

interface AttendanceLocationCardProps {
  result: ResolvedLocationResult;
  userRole?: string;
  projectName?: string;
}

export const AttendanceLocationCard: React.FC<AttendanceLocationCardProps> = ({
  result,
  userRole = 'Tech',
  projectName = 'Proyecto'
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Authorized roles for diagnostics view
  const isAuthorizedForDiagnostics = [
    'Supervisor',
    'Manager',
    'HR',
    'Office',
    'Admin',
    'SuperAdmin'
  ].includes(userRole);

  const { status, displayName, distanceMeters, radiusMeters, accuracyMeters, isOffline, closestCandidate } = result;

  // If GPS is still acquiring or not available
  if (status === 'ACQUIRING_GPS') {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-700 animate-pulse">
        <MapPin size={16} className="shrink-0 text-blue-500 animate-bounce" />
        <span>Adquiriendo señal GPS para validar ubicación autorizada...</span>
      </div>
    );
  }

  if (status === 'GPS_DENIED') {
    return (
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
        <AlertTriangle size={16} className="shrink-0 text-amber-600" />
        <span>GPS no disponible. Se requiere permiso de ubicación para validar asistencia presencial.</span>
      </div>
    );
  }

  if (status === 'NO_GEOFENCE') {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-700">
        <AlertTriangle size={16} className="shrink-0 text-gray-500" />
        <span>El proyecto seleccionado ({projectName}) no tiene geocerca presencial configurada.</span>
      </div>
    );
  }

  const isMatched = status === 'MATCHED';

  return (
    <div className="space-y-2">
      {/* 1. Normal Worker Reassuring Location Card */}
      {isMatched ? (
        <div className="p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/80 rounded-2xl shadow-sm text-teal-950 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-500 text-white rounded-xl shadow-xs">
                <MapPin size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm text-gray-900 tracking-tight">{displayName}</h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800 border border-teal-300/50">
                    Ubicación autorizada
                  </span>
                </div>
                <p className="text-xs text-teal-800/90 mt-0.5">
                  Dentro de geocerca • A {distanceMeters}m del punto (radio: {radiusMeters}m)
                </p>
              </div>
            </div>

            {/* Diagnostics toggle button */}
            {isAuthorizedForDiagnostics && (
              <button
                type="button"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="text-gray-400 hover:text-teal-700 p-1 rounded-lg transition-colors"
                title="Diagnóstico de Geocerca"
              >
                {showDiagnostics ? <ChevronUp size={16} /> : <Info size={16} />}
              </button>
            )}
          </div>

          {/* Offline notice (Requirement 8) */}
          {isOffline && (
            <div className="mt-2.5 pt-2 border-t border-teal-200/60 flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
              <WifiOff size={13} className="text-amber-600 shrink-0" />
              <span>Validación offline — Pendiente de sincronización con servidor</span>
            </div>
          )}
        </div>
      ) : (
        /* Outside Geofence Card (Uniform across all roles) */
        <div className="p-3.5 rounded-2xl border text-sm shadow-sm animate-in fade-in duration-200 bg-red-50/90 border-red-200 text-red-950">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                size={18}
                className="shrink-0 mt-0.5 text-red-600"
              />
              <div>
                <p className="font-bold text-sm">
                  Fuera de ubicación autorizada (Checada bloqueada)
                </p>
                <p className="text-xs mt-1 text-gray-700 leading-relaxed">
                  {closestCandidate
                    ? `Te encuentras fuera de las instalaciones autorizadas para ${projectName}. El punto más cercano es ${closestCandidate.location.name} a ${
                        closestCandidate.distanceMeters >= 1000
                          ? `${(closestCandidate.distanceMeters / 1000).toFixed(1)}km`
                          : `${closestCandidate.distanceMeters}m`
                      } (radio permitido: ${closestCandidate.location.radiusMeters}m).`
                    : `Te encuentras fuera de las ubicaciones autorizadas.`}
                  {' '}La asistencia presencial fuera de geocerca está bloqueada.
                </p>
              </div>
            </div>

            {/* Diagnostics toggle button */}
            {isAuthorizedForDiagnostics && (
              <button
                type="button"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg transition-colors"
                title="Diagnóstico de Geocerca"
              >
                {showDiagnostics ? <ChevronUp size={16} /> : <Info size={16} />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Support / Admin Diagnostics View (Requirement 10) */}
      {showDiagnostics && (
        <div className="p-3 bg-gray-900 text-gray-200 rounded-xl text-xs space-y-1.5 font-mono shadow-md border border-gray-800 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-gray-800 font-bold text-gray-300">
            <span className="flex items-center gap-1.5">
              <Info size={13} className="text-teal-400" /> Diagnóstico de Geocerca (V2)
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-800 text-teal-300">
              {isOffline ? 'OFFLINE' : 'ONLINE'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[11px]">
            <div>
              <span className="text-gray-400">Coordenadas GPS:</span>{' '}
              <span className="text-white">
                {result.diagnosticDetails.gpsLat?.toFixed(5) ?? 'N/A'}, {result.diagnosticDetails.gpsLng?.toFixed(5) ?? 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Precisión:</span>{' '}
              <span className="text-white">±{Math.round(accuracyMeters ?? 0)}m</span>
            </div>
            <div>
              <span className="text-gray-400">Ubicación detectada:</span>{' '}
              <span className="text-teal-300 font-semibold">{displayName}</span>
            </div>
            <div>
              <span className="text-gray-400">Distancia:</span>{' '}
              <span className="text-white">{distanceMeters !== null ? `${distanceMeters}m` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400">Radio permitido:</span>{' '}
              <span className="text-white">{radiusMeters !== null ? `${radiusMeters}m` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400">Fuente autorización:</span>{' '}
              <span className="text-amber-300">
                {result.diagnosticDetails.matchedSource || 'NINGUNA'}
              </span>
            </div>
          </div>

          {result.allEvaluations.length > 0 && (
            <div className="pt-2 border-t border-gray-800 text-[10px] text-gray-400 space-y-0.5">
              <div className="font-semibold text-gray-300">
                Geocercas evaluadas ({result.allEvaluations.length}):
              </div>
              {result.allEvaluations.map((e, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span>• {e.location.name} (radio {e.location.radiusMeters}m):</span>
                  <span className={e.isInside ? 'text-teal-400 font-semibold' : 'text-gray-500'}>
                    {e.distanceMeters}m — {e.isInside ? 'DENTRO' : 'FUERA'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
