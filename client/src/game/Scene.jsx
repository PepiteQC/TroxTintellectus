// src/game/Scene.jsx
import RoomArchitecture from './building/hotel/RoomArchitecture.jsx';
import StoreArchitecture from './building/depanneur/StoreArchitecture.jsx';
import { tryHotelSleep } from './building/hotel/hotelInteractions.js';
import { openShopUI, tryPurchase } from './building/depanneur/depanneurInteractions.js';

export function Scene({ kernel, player }) {
  return (
    <>
      {/* Hôtel — 3 chambres avec variantes */}
      <RoomArchitecture roomId="villa_nova"     position={[0, 0, 0]} />
      <RoomArchitecture roomId="modern_loft"    position={[12, 0, 0]} />
      <RoomArchitecture roomId="suburban_dream" position={[24, 0, 0]} />

      {/* Dépanneur */}
      <StoreArchitecture position={[0, 0, 30]} isOpen={true} />

      {/* Exemples d'appels programmatiques */}
      {/* await tryHotelSleep('villa_nova', player, kernel); */}
      {/* openShopUI('fix_fridge_dairy', player, kernel); */}
      {/* tryPurchase('inv_sloche', player, kernel); */}
    </>
  );
}