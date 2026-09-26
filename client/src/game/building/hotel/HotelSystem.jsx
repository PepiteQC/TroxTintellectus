// client/src/components/hotel/HotelSystem.jsx
// 🖼️ Panneau complet gestion hôtelière — Réservations & Boutique
import React, { useState } from 'react'
import { useHotelStore } from '@/store/hotelStore.js'
import { useGameStore } from '@/game/portneuf/store.js'
import { HOTEL_ROOMS, hotelRealtimeSecurity } from '@/game/hotel/HotelRealtimeSecurity.js'
import { Bed, ShoppingBag, BellRing, KeyRound, CheckCircle2 } from 'lucide-react'

export function HotelSystem() {
  const [activeTab, setActiveTab] = useState('rooms')
  const [selectedRoom, setSelectedRoom] = useState('villa_nova')
  const [guestName, setGuestName] = useState('')
  const [assignedCard, setAssignedCard] = useState('')
  const [assignedPin, setAssignedPin] = useState('')
  const [message, setMessage] = useState('')

  const hotelStore = useHotelStore()
  const playerCash = useGameStore((s) => s.cash)

  const handleIssueKey = (e) => {
    e.preventDefault()
    if (!guestName || !assignedCard) {
      setMessage('Veuillez remplir le nom et le numéro de carte.')
      return
    }

    hotelRealtimeSecurity.registerCredential({
      actorId: guestName.toLowerCase().replace(/\s+/g, '-'),
      cardUid: assignedCard,
      pin: assignedPin || '1234',
      roomIds: [selectedRoom],
      role: 'resident'
    })

    setMessage(`Clé émise avec succès pour ${guestName} (Chambre: ${selectedRoom})`)
    setGuestName('')
    setAssignedCard('')
    setAssignedPin('')
  }

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-3xl max-w-4xl mx-auto border border-amber-500/30 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-amber-300">
              🏨 Manoir Deschambault &amp; Auberges de Portneuf
            </h2>
            <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Système Hôtelier Unifié
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Réservations, Boutique Terroir / Minibar &amp; Contrôle d'accès Medeco en temps réel
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 text-right">
          <span className="text-[10px] text-slate-400 block">Solde Actuel Joueur</span>
          <span className="text-emerald-400 font-mono font-bold text-lg">
            {playerCash.toFixed(2)} $ CAD
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'rooms'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Bed className="w-4 h-4" />
          Chambres &amp; Réservations ({hotelStore.rooms.length})
        </button>

        <button
          onClick={() => setActiveTab('shop')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'shop'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Boutique Terroir &amp; Minibar ({hotelStore.shopItems.length})
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'services'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <BellRing className="w-4 h-4" />
          Conciergerie ({hotelStore.services.length})
        </button>

        <button
          onClick={() => setActiveTab('keys')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'keys'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Émission Clés Medeco
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-slate-400 hover:text-white">Fermer</button>
        </div>
      )}

      {activeTab === 'rooms' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hotelStore.rooms.map((room) => {
              const isOccupied = room.isOccupied
              const isMyBooking = hotelStore.activeBooking?.roomNumber === room.number

              return (
                <div
                  key={room.number}
                  className={`p-4 rounded-2xl border transition-all ${
                    isMyBooking
                      ? 'bg-slate-850 border-amber-500 shadow-lg'
                      : 'bg-slate-800/80 border-slate-700/80'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          #{room.number}
                        </span>
                        <span className="text-xs text-slate-400">Étage {room.floor}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-1">{room.title}</h3>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-300 text-base">
                        {room.nightlyRateCAD.toFixed(2)} $
                      </span>
                      <span className="text-[10px] text-slate-400 block">/ nuit</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mb-3">{room.description}</p>

                  <div className="flex items-center justify-between border-t border-slate-700/80 pt-3">
                    <span className={`text-xs flex items-center gap-1.5 ${isOccupied ? 'text-rose-400' : 'text-emerald-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                      {isMyBooking ? 'Votre réservation' : isOccupied ? 'Occupée' : 'Disponible'}
                    </span>

                    {isMyBooking ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const res = hotelStore.digitalUnlockDoor(room.number)
                            setMessage(res.message)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                        >
                          Déverrouiller
                        </button>
                        <button
                          onClick={() => {
                            const res = hotelStore.checkout(room.number)
                            setMessage(res.message)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-rose-900 text-slate-200 text-xs font-medium"
                        >
                          Check-out
                        </button>
                      </div>
                    ) : isOccupied ? (
                      <span className="text-xs text-slate-500">Non réservable</span>
                    ) : (
                      <button
                        onClick={() => {
                          const res = hotelStore.bookRoom(room.number, 1, 'Client EtherWorld')
                          setMessage(res.message)
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow"
                      >
                        Réserver 1 nuit
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'shop' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {hotelStore.shopItems.map((item) => (
            <div
              key={item.id}
              className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-2xl p-2 bg-slate-900 rounded-xl">{item.icon}</span>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {item.priceCAD.toFixed(2)} $
                  </span>
                </div>
                <h4 className="font-bold text-xs text-slate-100">{item.name}</h4>
                <p className="text-[11px] text-slate-400 mt-1">{item.description}</p>
              </div>

              <button
                onClick={() => {
                  const res = hotelStore.purchaseShopItem(item.id)
                  setMessage(res.message)
                }}
                disabled={playerCash < item.priceCAD}
                className="mt-3 w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition disabled:opacity-40"
              >
                Acheter
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'services' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hotelStore.services.map((serv) => (
            <div
              key={serv.id}
              className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{serv.icon}</span>
                    <h4 className="font-bold text-sm text-slate-100">{serv.title}</h4>
                  </div>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {serv.priceCAD.toFixed(2)} $
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{serv.description}</p>
              </div>

              <button
                onClick={() => {
                  const res = hotelStore.orderService(serv.id, hotelStore.activeBooking?.roomNumber || '202')
                  setMessage(res.message)
                }}
                disabled={playerCash < serv.priceCAD}
                className="mt-3 w-full py-2 rounded-lg bg-slate-700 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-bold text-xs transition disabled:opacity-40"
              >
                Commander ce service
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'keys' && (
        <form onSubmit={handleIssueKey} className="max-w-md space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sélection de la Chambre</label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-700 text-slate-100 rounded-xl text-xs outline-none"
            >
              {HOTEL_ROOMS.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Nom de l'occupant</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Ex: Alexandre Tremblay"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 text-slate-100 rounded-xl text-xs outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">UID Carte RFID</label>
            <input
              type="text"
              value={assignedCard}
              onChange={(e) => setAssignedCard(e.target.value)}
              placeholder="Ex: CARD-DESCHAMBAULT-01"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 text-slate-100 rounded-xl text-xs outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Code NIP numérique</label>
            <input
              type="text"
              value={assignedPin}
              onChange={(e) => setAssignedPin(e.target.value)}
              placeholder="Ex: 2020"
              className="w-full p-2.5 bg-slate-950 border border-slate-700 text-slate-100 rounded-xl text-xs outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-md"
          >
            Émettre et Enregistrer la Clé
          </button>
        </form>
      )}
    </div>
  )
}