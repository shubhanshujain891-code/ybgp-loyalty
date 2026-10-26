import React from 'react';
import { Users, MapPin, Shield, Plus, Building2 } from 'lucide-react';
import { Business, User } from '../../types';
import { dbService } from '../../services/db';

interface TeamAndLocationsProps {
  business: Business;
  currentUser: User;
}

export const TeamAndLocations: React.FC<TeamAndLocationsProps> = ({
  business,
  currentUser,
}) => {
  const locations = dbService.getLocationsByBusiness(business.id);
  const memberships = dbService.getMembershipsByBusiness(business.id);
  const allUsers = dbService.getUsers();

  return (
    <div className="space-y-6">
      {/* Locations */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Business Outlets & Locations
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Authorized branches where customer stamps and rewards are awarded.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-bold text-slate-900">{loc.name}</span>
                </div>
                {loc.isPrimary && (
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded">
                    Primary Flagship
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{loc.address}</span>
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Code: {loc.code} · Phone: {loc.phone}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Members & RBAC */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Staff Team & Role-Based Access Control
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Role permissions: Owners manage billing; Managers configure rewards; Cashiers scan & award stamps.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {memberships.map((m) => {
            const user = allUsers.find((u) => u.id === m.userId);
            if (!user) return null;
            return (
              <div key={m.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{user.name}</h4>
                    <p className="text-[11px] text-slate-500">{user.email} · {user.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      m.role === 'owner'
                        ? 'bg-amber-100 text-amber-900'
                        : m.role === 'manager'
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {m.role}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    ● Active
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
