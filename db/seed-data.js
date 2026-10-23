// Datos de ejemplo (mismos que usa el modo demo del front). Precios, fechas y aerolíneas inventados.
// Los destinos salen sin imágenes: se cargan desde el panel (Destinos).

export const SEED_DESTINATIONS = [
  {
    "id": 1,
    "name": "Punta Cana",
    "country": "República Dominicana",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 2,
    "name": "Cusco",
    "country": "Perú",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 3,
    "name": "Río de Janeiro",
    "country": "Brasil",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 4,
    "name": "Cancún",
    "country": "México",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 5,
    "name": "Costa Brasileña",
    "country": "Brasil",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 6,
    "name": "Mediterráneo",
    "country": "Europa",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 7,
    "name": "Miami",
    "country": "Estados Unidos",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 8,
    "name": "Madrid",
    "country": "España",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 9,
    "name": "Orlando",
    "country": "Estados Unidos",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 10,
    "name": "Aruba",
    "country": "Aruba",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 11,
    "name": "Bariloche",
    "country": "Argentina",
    "scope": "nacional",
    "images": []
  },
  {
    "id": 12,
    "name": "Cataratas del Iguazú",
    "country": "Argentina",
    "scope": "nacional",
    "images": []
  },
  {
    "id": 13,
    "name": "Salta",
    "country": "Argentina",
    "scope": "nacional",
    "images": []
  },
  {
    "id": 14,
    "name": "Ushuaia",
    "country": "Argentina",
    "scope": "nacional",
    "images": []
  },
  {
    "id": 15,
    "name": "Mendoza",
    "country": "Argentina",
    "scope": "nacional",
    "images": []
  },
  {
    "id": 16,
    "name": "Tokio",
    "country": "Japón",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 17,
    "name": "Nueva York",
    "country": "Estados Unidos",
    "scope": "internacional",
    "images": []
  },
  {
    "id": 18,
    "name": "Santiago de Chile",
    "country": "Chile",
    "scope": "internacional",
    "images": []
  }
]

export const SEED_TRIPS = [
  {
    "id": 1,
    "category": "paquete",
    "destinationId": 1,
    "title": "Caribe Todo Incluido",
    "nights": 7,
    "currency": "USD",
    "price": 2450,
    "offer": {
      "type": "discount",
      "price": 2190,
      "until": "2026-12-31"
    },
    "departure": "2027-01-15",
    "from": "Buenos Aires",
    "summary": "Siete noches frente al mar con vuelo directo, traslados y régimen all inclusive.",
    "includes": [
      "Vuelo directo ida y vuelta",
      "Traslados aeropuerto-hotel",
      "7 noches en resort 5★",
      "All inclusive",
      "Asistencia al viajero"
    ],
    "hotel": "Resort 5★ frente a la playa, piscinas, spa y actividades diarias.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 2,
    "category": "paquete",
    "destinationId": 2,
    "title": "Lima y Machu Picchu",
    "nights": 6,
    "currency": "USD",
    "price": 1590,
    "offer": null,
    "departure": "2027-03-10",
    "from": "Buenos Aires",
    "summary": "Gastronomía en Lima, Valle Sagrado y la ciudadela inca con tren panorámico.",
    "includes": [
      "Vuelos con escala",
      "2 noches en Lima y 4 en Cusco",
      "Tren a Machu Picchu",
      "Visita guiada",
      "Desayunos"
    ],
    "hotel": "Hoteles 4★ céntricos en Lima y Cusco.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 3,
    "category": "paquete",
    "destinationId": 3,
    "title": "Río y Búzios",
    "nights": 8,
    "currency": "ARS",
    "price": 1850000,
    "offer": null,
    "departure": "2027-02-05",
    "from": "Buenos Aires",
    "summary": "Ciudad maravillosa y playas de Búzios en un solo viaje.",
    "includes": [
      "Vuelo directo",
      "Traslados",
      "4 noches en Río y 4 en Búzios",
      "Desayuno",
      "Seguro de viaje"
    ],
    "hotel": "Hotel 4★ en Copacabana y posada boutique en Búzios.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 4,
    "category": "paquete",
    "destinationId": 4,
    "title": "Cancún y Riviera Maya",
    "nights": 9,
    "currency": "USD",
    "price": 2890,
    "offer": null,
    "departure": "2027-04-20",
    "from": "Buenos Aires",
    "summary": "Playas turquesas, cenotes y ruinas mayas con todo incluido.",
    "includes": [
      "Vuelos con escala",
      "Traslados",
      "9 noches all inclusive",
      "Excursión a Chichén Itzá",
      "Seguro de viaje"
    ],
    "hotel": "Resort 5★ en la Riviera Maya con acceso directo a la playa.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 5,
    "category": "crucero",
    "destinationId": 5,
    "title": "Brasil en Enero",
    "nights": 10,
    "currency": "USD",
    "price": 1167,
    "offer": null,
    "departure": "2027-01-05",
    "from": "Buenos Aires",
    "summary": "Diez días navegando por las mejores playas de Brasil.",
    "includes": [
      "Cabina interna",
      "Pensión completa",
      "Paquete de bebidas",
      "Shows y entretenimiento",
      "Tasas portuarias"
    ],
    "hotel": "Cabina a bordo con baño privado.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 6,
    "category": "crucero",
    "destinationId": 5,
    "title": "Brasil en Marzo",
    "nights": 8,
    "currency": "USD",
    "price": 1072,
    "offer": {
      "type": "promo",
      "label": "2x1",
      "note": "Pagás un solo pasaje y viajan dos personas en la misma cabina."
    },
    "departure": "2027-03-08",
    "from": "Buenos Aires",
    "summary": "Itinerario de nueve días con salida desde Buenos Aires.",
    "includes": [
      "Cabina interna",
      "Pensión completa",
      "Paquete de bebidas",
      "Entretenimiento"
    ],
    "hotel": "Cabina a bordo con baño privado.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 7,
    "category": "crucero",
    "destinationId": 6,
    "title": "Mediterráneo Clásico",
    "nights": 12,
    "currency": "USD",
    "price": 3350,
    "offer": null,
    "departure": "2027-06-12",
    "from": "Barcelona",
    "summary": "Barcelona, Marsella, Génova y Roma en un itinerario de doce noches.",
    "includes": [
      "Cabina con balcón",
      "Pensión completa",
      "Entretenimiento",
      "Tasas portuarias"
    ],
    "hotel": "Cabina con balcón privado.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 8,
    "category": "hotel",
    "destinationId": 3,
    "title": "Hotel frente a Copacabana",
    "nights": 5,
    "currency": "ARS",
    "price": 590000,
    "offer": null,
    "departure": "2027-02-12",
    "from": "Buenos Aires",
    "summary": "Cinco noches con desayuno a una cuadra de la playa.",
    "includes": [
      "5 noches con desayuno",
      "Wi-Fi",
      "Piscina en terraza"
    ],
    "hotel": "Hotel 4★ en Copacabana con vista parcial al mar.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 9,
    "category": "hotel",
    "destinationId": 7,
    "title": "Boutique en Miami Beach",
    "nights": 7,
    "currency": "USD",
    "price": 980,
    "offer": {
      "type": "promo",
      "label": "3x2",
      "note": "Por cada 3 noches pagás solo 2."
    },
    "departure": "2027-03-22",
    "from": "Buenos Aires",
    "summary": "Siete noches en South Beach con acceso a la playa.",
    "includes": [
      "7 noches",
      "Wi-Fi",
      "Acceso a la playa"
    ],
    "hotel": "Hotel boutique art déco en South Beach.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 10,
    "category": "paquete",
    "destinationId": 8,
    "title": "Madrid y Andalucía",
    "nights": 11,
    "currency": "USD",
    "price": 3120,
    "offer": {
      "type": "discount",
      "price": 2850
    },
    "departure": "2027-05-09",
    "from": "Buenos Aires",
    "summary": "Madrid, Córdoba, Sevilla y Granada en un recorrido por el sur de España.",
    "includes": [
      "Vuelo directo",
      "Traslados",
      "11 noches con desayuno",
      "Tren Madrid-Sevilla",
      "Visita a la Alhambra"
    ],
    "hotel": "Hoteles 4★ céntricos en cada ciudad.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 11,
    "category": "paquete",
    "destinationId": 9,
    "title": "Orlando y Parques",
    "nights": 10,
    "currency": "USD",
    "price": 3980,
    "offer": null,
    "departure": "2027-07-03",
    "from": "Buenos Aires",
    "summary": "Diez noches ideales para ir en familia, con entradas a parques incluidas.",
    "includes": [
      "Vuelos con escala",
      "Traslados",
      "10 noches",
      "Entradas a 3 parques"
    ],
    "hotel": "Hotel familiar con piscina cerca de los parques.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 12,
    "category": "paquete",
    "destinationId": 10,
    "title": "Aruba Directo",
    "nights": 7,
    "currency": "USD",
    "price": 2665,
    "offer": null,
    "departure": "2027-02-20",
    "from": "Buenos Aires",
    "summary": "Siete noches en el Caribe holandés con vuelo directo y traslados.",
    "includes": [
      "Vuelo directo",
      "Traslados",
      "7 noches",
      "Seguro de viaje"
    ],
    "hotel": "Hotel 4★ a pasos de Eagle Beach.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 13,
    "category": "paquete",
    "destinationId": 11,
    "title": "Bariloche en Invierno",
    "nights": 7,
    "currency": "ARS",
    "price": 890000,
    "offer": null,
    "departure": "2027-07-10",
    "from": "Buenos Aires",
    "summary": "Una semana de nieve, chocolate y lagos en la Patagonia andina.",
    "includes": [
      "Vuelo ida y vuelta",
      "Traslados",
      "7 noches con desayuno",
      "Excursión Circuito Chico",
      "Asistencia al viajero"
    ],
    "hotel": "Hotel 4★ con vista al lago Nahuel Huapi.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 14,
    "category": "paquete",
    "destinationId": 12,
    "title": "Cataratas del Iguazú",
    "nights": 4,
    "currency": "ARS",
    "price": 520000,
    "offer": null,
    "departure": "2027-04-02",
    "from": "Buenos Aires",
    "summary": "Cuatro noches para recorrer las cataratas y la selva misionera.",
    "includes": [
      "Vuelo ida y vuelta",
      "Traslados",
      "4 noches con desayuno",
      "Entradas al Parque Nacional",
      "Paseo a la Garganta del Diablo"
    ],
    "hotel": "Hotel 4★ en Puerto Iguazú, cerca del centro.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 15,
    "category": "paquete",
    "destinationId": 13,
    "title": "Salta y Jujuy",
    "nights": 6,
    "currency": "ARS",
    "price": 760000,
    "offer": {
      "type": "promo",
      "label": "2x1",
      "note": "Pagás un solo pasaje y viajan dos personas."
    },
    "departure": "2027-05-14",
    "from": "Buenos Aires",
    "summary": "Colores del norte argentino: quebradas, viñedos de altura y pueblos de adobe.",
    "includes": [
      "Vuelo ida y vuelta",
      "Traslados",
      "6 noches con desayuno",
      "Excursión a Quebrada de Humahuaca",
      "Excursión a Cafayate"
    ],
    "hotel": "Hoteles 4★ en Salta capital y Purmamarca.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 16,
    "category": "paquete",
    "destinationId": 14,
    "title": "Ushuaia, Fin del Mundo",
    "nights": 5,
    "currency": "ARS",
    "price": 1150000,
    "offer": {
      "type": "discount",
      "price": 980000,
      "until": "2026-12-31"
    },
    "departure": "2027-01-25",
    "from": "Buenos Aires",
    "summary": "Navegación por el Canal Beagle y trekking en el Parque Nacional Tierra del Fuego.",
    "includes": [
      "Vuelo ida y vuelta",
      "Traslados",
      "5 noches con desayuno",
      "Navegación por el Canal Beagle",
      "Entrada al Parque Nacional"
    ],
    "hotel": "Hotel 4★ con vista al Canal Beagle.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 17,
    "category": "hotel",
    "destinationId": 15,
    "title": "Hotel entre viñedos",
    "nights": 3,
    "currency": "ARS",
    "price": 280000,
    "offer": null,
    "departure": "2027-03-12",
    "from": "Buenos Aires",
    "summary": "Tres noches en Mendoza durante la vendimia, con desayuno incluido.",
    "includes": [
      "3 noches con desayuno",
      "Wi-Fi",
      "Piscina"
    ],
    "hotel": "Hotel 4★ cerca de la plaza Independencia.",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 18,
    "category": "vuelo",
    "destinationId": 16,
    "title": "Buenos Aires – Tokio",
    "nights": null,
    "currency": "USD",
    "price": 2150,
    "offer": {
      "type": "discount",
      "price": 1890
    },
    "departure": "2027-04-05",
    "from": "Buenos Aires",
    "summary": "Vuelo ida y vuelta a Japón, ideal para la temporada de cerezos en flor.",
    "includes": [
      "Pasaje ida y vuelta en clase económica",
      "Equipaje de mano",
      "1 valija despachada de 23 kg",
      "Tasas e impuestos"
    ],
    "hotel": null,
    "airline": "Qatar Airways",
    "tripKind": "Ida y vuelta",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 19,
    "category": "vuelo",
    "destinationId": 17,
    "title": "Buenos Aires – Nueva York",
    "nights": null,
    "currency": "USD",
    "price": 1180,
    "offer": null,
    "departure": "2027-03-18",
    "from": "Buenos Aires",
    "summary": "Vuelo ida y vuelta a la Gran Manzana.",
    "includes": [
      "Pasaje ida y vuelta en clase económica",
      "Equipaje de mano",
      "1 valija despachada de 23 kg",
      "Tasas e impuestos"
    ],
    "hotel": null,
    "airline": "American Airlines",
    "tripKind": "Ida y vuelta",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 20,
    "category": "vuelo",
    "destinationId": 18,
    "title": "Buenos Aires – Santiago de Chile",
    "nights": null,
    "currency": "USD",
    "price": 266,
    "offer": null,
    "departure": "2027-02-08",
    "from": "Buenos Aires",
    "summary": "Escapada corta a Santiago, con la cordillera de fondo.",
    "includes": [
      "Pasaje ida y vuelta en clase económica",
      "Equipaje de mano",
      "Tasas e impuestos"
    ],
    "hotel": null,
    "airline": "SKY Airline",
    "tripKind": "Ida y vuelta",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 21,
    "category": "vuelo",
    "destinationId": 14,
    "title": "Buenos Aires – Ushuaia",
    "nights": null,
    "currency": "ARS",
    "price": 420000,
    "offer": null,
    "departure": "2027-02-15",
    "from": "Buenos Aires",
    "summary": "Vuelo ida y vuelta a la ciudad más austral del mundo.",
    "includes": [
      "Pasaje ida y vuelta en clase económica",
      "Equipaje de mano",
      "1 valija despachada de 15 kg",
      "Tasas e impuestos"
    ],
    "hotel": null,
    "airline": "Aerolíneas Argentinas",
    "tripKind": "Ida y vuelta",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  },
  {
    "id": 22,
    "category": "vuelo",
    "destinationId": 11,
    "title": "Buenos Aires – Bariloche",
    "nights": null,
    "currency": "ARS",
    "price": 260000,
    "offer": {
      "type": "discount",
      "price": 229000
    },
    "departure": "2027-07-09",
    "from": "Buenos Aires",
    "summary": "Vuelo ida y vuelta para las vacaciones de invierno.",
    "includes": [
      "Pasaje ida y vuelta en clase económica",
      "Equipaje de mano",
      "1 valija despachada de 15 kg",
      "Tasas e impuestos"
    ],
    "hotel": null,
    "airline": "Aerolíneas Argentinas",
    "tripKind": "Ida y vuelta",
    "active": true,
    "createdAt": "2026-10-21T00:00:00.000Z",
    "updatedAt": "2026-10-21T00:00:00.000Z"
  }
]
