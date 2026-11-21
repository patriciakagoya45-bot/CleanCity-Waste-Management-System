const serviceAreas = {
    Central: ["Kololo", "Makerere", "Nakasero", "Old Kampala"],
    Kawempe: ["Bwaise", "Kanyanya", "Kawempe", "Kazo", "Komamboga", "Mulago"],
    Makindye: ["Kabalagala", "Kibuye", "Kisugu", "Lukuli", "Nsambya"],
    Nakawa: ["Bugolobi", "Luzira", "Nakawa", "Ntinda"],
    Rubaga: ["Busega", "Lubaga", "Mengo", "Namirembe", "Nateete"]
};

const wastePricesUgx = {
    general: 7000,
    organic: 4000,
    paper: 6000,
    "e-waste": 10000,
    metal: 8000,
    plastic: 5000
};

const isValidServiceArea = (division, parish) =>
    Object.hasOwn(serviceAreas, division) && serviceAreas[division].includes(parish);

module.exports = { serviceAreas, wastePricesUgx, isValidServiceArea };
