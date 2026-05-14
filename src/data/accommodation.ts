/**
 * Static accommodation suggestions for well-known destinations.
 * Keyed by city id (matches CityEntry.id in cities.json).
 * Injected into Destination objects at compute time so the
 * "Where to stay" section has data to display immediately.
 */

import type { Accommodation } from '../types'

export const ACCOMMODATION: Record<string, Accommodation[]> = {
  paris: [
    { name: 'Generator Paris',          type: 'Hostel',    price: '£28/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Paris&nflt=ht_id%3D203' },
    { name: 'Hotel Félicien',           type: 'Boutique',  price: '£110/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Paris' },
    { name: 'Citadines Opéra',          type: 'Apartment', price: '£85/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Paris&nflt=ht_id%3D201' },
  ],
  amsterdam: [
    { name: 'Stayokay Amsterdam',       type: 'Hostel',    price: '£32/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Amsterdam&nflt=ht_id%3D203' },
    { name: 'Hotel V Nesplein',         type: 'Boutique',  price: '£95/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Amsterdam' },
    { name: 'Eric Vökel Suites',        type: 'Apartment', price: '£78/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Amsterdam&nflt=ht_id%3D201' },
  ],
  barcelona: [
    { name: 'Casa Gracia Barcelona',    type: 'Hostel',    price: '£30/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Barcelona&nflt=ht_id%3D203' },
    { name: 'Praktik Rambla',          type: 'Hotel',     price: '£88/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Barcelona' },
    { name: 'Aspasios Rambla',         type: 'Apartment', price: '£72/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Barcelona&nflt=ht_id%3D201' },
  ],
  rome: [
    { name: 'The Yellow Roma',          type: 'Hostel',    price: '£27/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Rome&nflt=ht_id%3D203' },
    { name: 'Hotel Artemide',           type: 'Hotel',     price: '£105/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Rome' },
    { name: 'Trastevere Apartments',    type: 'Apartment', price: '£68/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Rome&nflt=ht_id%3D201' },
  ],
  lisbon: [
    { name: 'Lisbon Lounge Hostel',     type: 'Hostel',    price: '£22/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Lisbon&nflt=ht_id%3D203' },
    { name: 'Memmo Alfama',             type: 'Boutique',  price: '£118/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Lisbon' },
    { name: 'LX Way Apartments',        type: 'Apartment', price: '£62/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Lisbon&nflt=ht_id%3D201' },
  ],
  berlin: [
    { name: 'EastSeven Berlin Hostel',  type: 'Hostel',    price: '£24/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Berlin&nflt=ht_id%3D203' },
    { name: 'Boutique Hotel i31',       type: 'Boutique',  price: '£90/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Berlin' },
    { name: 'City Apartments Berlin',   type: 'Apartment', price: '£58/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Berlin&nflt=ht_id%3D201' },
  ],
  prague: [
    { name: 'Mosaic House Prague',      type: 'Hostel',    price: '£18/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Prague&nflt=ht_id%3D203' },
    { name: 'Hotel Josef',              type: 'Boutique',  price: '£75/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Prague' },
    { name: 'Wenceslas Square Flat',    type: 'Apartment', price: '£45/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Prague&nflt=ht_id%3D201' },
  ],
  edinburgh: [
    { name: 'Castle Rock Hostel',       type: 'Hostel',    price: '£22/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Edinburgh&nflt=ht_id%3D203' },
    { name: 'The Bonham',               type: 'Boutique',  price: '£115/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Edinburgh' },
    { name: 'Apart-Hotel Residence Inn',type: 'Apartment', price: '£82/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Edinburgh&nflt=ht_id%3D201' },
  ],
  dublin: [
    { name: 'Abbey Court Hostel',       type: 'Hostel',    price: '£25/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Dublin&nflt=ht_id%3D203' },
    { name: 'The Wilder Townhouse',     type: 'Boutique',  price: '£130/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Dublin' },
    { name: 'Staycity Aparthotels',     type: 'Apartment', price: '£88/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Dublin&nflt=ht_id%3D201' },
  ],
  madrid: [
    { name: 'Mad4you Hostel',           type: 'Hostel',    price: '£20/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Madrid&nflt=ht_id%3D203' },
    { name: 'Room Mate Óscar',          type: 'Boutique',  price: '£85/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Madrid' },
    { name: 'Eric Vökel Gran Vía',      type: 'Apartment', price: '£65/night', link: 'https://www.booking.com/searchresults.en-gb.html?ss=Madrid&nflt=ht_id%3D201' },
  ],
}
