// --- Elemente din HTML (selectare) ---
// Aici legam JavaScript-ul de controalele din pagina.
// Exemple: sliderul de RPM, selectorul de combustibil, textul care arata viteza etc.
const maxRPMRangerElement = document.getElementById("max-rpm-selector");
const maxRPMRangerOutputElement = document.getElementById("max-rpm");

const combustibleTypeSelectorElement = document.getElementById("combustible-type-selector");
const combustibleTypeOutputElement = document.getElementById("combustible-type");

const torqueSelectorElement = document.getElementById("torque-selector");
const torqueOutputElement = document.getElementById("torque");

const horsePowerOutputElement = document.getElementById("horse-power");

const coolingTypeSelectorElement = document.getElementById("cooling-type-selector");
const coolingTypeOutputElement = document.getElementById("cooling-type");

const turboTypeSelectorElement = document.getElementById("turbo-type-selector");
const turboTypeOutputElement = document.getElementById("turbo-type");

const turboPressionSelectorElement = document.getElementById("turbo-pression-selector");
const turboPressionOutputElement = document.getElementById("turbo-pression");

const engineSizeSelectorElement = document.getElementById("engine-size-selector");
const engineSizeOutputElement = document.getElementById("engine-size");

const engineMaterialSelectorElement = document.getElementById("engine-material-selector");
const engineMaterialOutputElement = document.getElementById("engine-material");

const engineTypeSelectorElement = document.getElementById("engine-type-selector");
const engineTypeOutputElement = document.getElementById("engine-type");

const engineWeightOutputElement = document.getElementById("engine-weight");

const carBodyWeightSelectorElement = document.getElementById("car-body-weight-selector");
const carBodyWeightOutputElement = document.getElementById("car-body-weight");

const forcingCarProcentSelectorElement = document.getElementById("forcing-car-procent-selector");
const forcingCarProcentOutputElement = document.getElementById("forcing-car-procent");

const carBodyAerodinamicsRatingSelectorElement = document.getElementById("car-aerodinamics-rating-selector");
const carBodyAerodinamicsRatingOutputElement = document.getElementById("car-aerodinamics-rating");

const brakeTypeSelectorElement = document.getElementById("brake-type-selector");

// 2. Alte elemente
const startEngineButton = document.getElementById("starting-car-button");
const accelerateCarButton = document.getElementById("accelerating-car-button");

const currentSpeed = document.getElementById("current-speed");
const currentRPM = document.getElementById("current-rpm");
const currentAcumulatedWear = document.getElementById("current-acumulated-wear");
const currentOilTemperature = document.getElementById("current-oil-temperature");
const currentMileage = document.getElementById("current-mileage");

// Variabile care arata status-ul curent al masinii.
// Diferenta importanta:
// - elementele de mai sus sunt bucati din pagina
// - variabilele de mai jos sunt valorile reale cu care calculeaza simulatorul
let current_speed = Number(currentSpeed.textContent);
let current_rpm = Number(currentRPM.textContent);
let current_acumulated_wear = Number(currentAcumulatedWear.textContent);
let current_oil_temperature = Number(currentOilTemperature.textContent);
let current_mileage = Number(currentMileage.textContent);

// Aceste boolean-uri sunt ca niste intrerupatoare.
// Ele spun in ce stare este masina in momentul asta.
let car_is_on = false;
let car_is_accelerating = false;
let car_is_braking = false;
let simulation_interval_id = null;

// Cateva valori de baza pentru simulare.
// Le tinem in constante ca sa fie usor de schimbat mai tarziu.
const AMBIENT_TEMPERATURE = 24;
const MIN_OIL_TEMPERATURE = 20;
const IDLE_RPM_GASOLINE = 850;
const IDLE_RPM_DIESEL = 750;

// clamp() tine o valoare intre doua limite.
// Exemplu: clamp(150, 0, 100) intoarce 100, fiindca 150 e peste limita.
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// moveTowards() misca o valoare incet spre o tinta.
// O folosim la RPM ca acul sa urce/coboare treptat, nu instant.
function moveTowards(currentValue, targetValue, maxStep) {
    if (currentValue < targetValue) {
        return Math.min(currentValue + maxStep, targetValue);
    }

    return Math.max(currentValue - maxStep, targetValue);
}

function getNumberFromOutput(element, fallbackValue = 0) {
    const value = Number.parseFloat(element.textContent);
    return Number.isFinite(value) ? value : fallbackValue;
}

function getIdleRPM() {
    return combustibleTypeSelectorElement.value === "diesel" ? IDLE_RPM_DIESEL : IDLE_RPM_GASOLINE;
}

// Sliderul "Forcing car at" devine un numar intre 0.10 si 1.00.
// Practic este cat de tare apesi acceleratia.
function getThrottlePercent() {
    return Number(forcingCarProcentSelectorElement.value) / 100;
}

// Greutatea totala nu este doar caroseria.
// Adaugam si greutatea motorului, fiindca un motor mai greu face masina mai lenta.
function getTotalCarWeight() {
    return Number(carBodyWeightSelectorElement.value) + Number(calculateEngineWeight());
}

function getAeroRating() {
    return Number(carBodyAerodinamicsRatingSelectorElement.value);
}

// Turbo-ul incalzeste motorul mai tare, mai ales la presiune mare.
// De asta intoarcem un bonus de caldura care va fi folosit la temperatura uleiului.
function getTurboHeatBonus() {
    if (turboTypeSelectorElement.value === "turbo") {
        return 7 + Number(turboPressionSelectorElement.value) * 2.2;
    }

    if (turboTypeSelectorElement.value === "twin-turbo") {
        return 11 + Number(turboPressionSelectorElement.value) * 3.1;
    }

    return 0;
}

function getBrakePower() {
    // Fiecare tip de frana are o putere de franare de baza.
    // Cu cat valoarea e mai mare, cu atat masina pierde viteza mai repede.
    const brakePowerByType = {
        drum: 18,
        disc: 25,
        ventilated_disc: 31,
        performance_disc: 39,
        carbon_ceramic: 48,
    };

    const baseBrakePower = brakePowerByType[brakeTypeSelectorElement.value] || brakePowerByType.disc;

    // O masina grea se opreste mai greu.
    // sqrt() face penalizarea mai blanda, ca sa nu devina exagerata.
    const weightPenalty = Math.sqrt(1200 / getTotalCarWeight());

    return baseBrakePower * clamp(weightPenalty, 0.45, 1.35);
}

function calculateTopSpeed() {
    // Viteza maxima estimata depinde de putere, greutate, aerodinamica si temperatura.
    const horsePower = Number(calculateHorsePower());
    const totalWeight = getTotalCarWeight();
    const aeroRating = getAeroRating();

    // Aerodinamica buna ajuta masina sa urce mai sus in viteza.
    const aeroBonus = 0.72 + aeroRating * 0.055;

    // Greutatea peste 1000 kg scade viteza maxima.
    const weightPenalty = Math.max(0, (totalWeight - 1000) * 0.018);

    // Daca uleiul e prea fierbinte, motorul este tratat ca fiind mai putin eficient.
    const coolingPenalty = current_oil_temperature > 125 ? (current_oil_temperature - 125) * 0.45 : 0;

    return clamp(60 + Math.sqrt(horsePower) * 10.8 * aeroBonus - weightPenalty - coolingPenalty, 45, 430);
}

function calculateAccelerationPerSecond(topSpeed) {
    // Daca motorul nu e pornit sau nu acceleram, nu avem ce impinge masina.
    if (!car_is_on || !car_is_accelerating) {
        return 0;
    }

    const horsePower = Number(calculateHorsePower());
    const torque = Number(torqueSelectorElement.value);
    const totalWeight = getTotalCarWeight();
    const throttle = getThrottlePercent();
    const aeroRating = getAeroRating();
    const speedRatio = clamp(current_speed / topSpeed, 0, 1);

    // Cuplul mare ajuta mai ales la plecarea de pe loc si la reprize.
    const torqueBonus = clamp(torque / 260, 0.45, 2.25);

    // La viteze mici dam un mic boost ca plecarea de pe loc sa se simta mai vioaie.
    const launchBoost = current_speed < 35 ? 1.18 : 1;

    // Motorul pierde eficienta cand uleiul este foarte fierbinte.
    const temperatureEfficiency = current_oil_temperature > 135
        ? clamp(1 - (current_oil_temperature - 135) / 75, 0.45, 1)
        : 1;

    // enginePush este "forta" aproximativa care accelereaza masina.
    // Raportul horsePower / totalWeight e miezul formulei: putere multa + greutate mica = acceleratie buna.
    const enginePush = (horsePower / totalWeight) * 67 * throttle * torqueBonus * launchBoost * temperatureEfficiency;

    // Rezistenta aerului creste mult la viteza mare.
    // De asta folosim speedRatio la patrat: la viteze mari te loveste mult mai tare.
    const airResistance = Math.pow(speedRatio, 2) * (8.5 - aeroRating * 0.42);

    // Rezistenta de rulare este frecarea de baza: cauciucuri, transmisie, greutate etc.
    const rollingResistance = 0.38 + totalWeight / 12000;

    return enginePush - airResistance - rollingResistance;
}

function updateRPM(deltaTime, topSpeed) {
    // Aici decidem unde "vrea" sa ajunga RPM-ul, apoi il miscam treptat spre tinta.
    const maxRPM = Number(maxRPMRangerElement.value);
    const idleRPM = getIdleRPM();
    let targetRPM = 0;

    if (car_is_on) {
        const throttle = car_is_accelerating ? getThrottlePercent() : 0;
        const speedRatio = clamp(current_speed / topSpeed, 0, 1);

        // loadRatio combina pedala de acceleratie cu viteza curenta.
        // Cand accelerezi tare, RPM-ul urca mai sus. Cand masina deja merge repede, ramane mai incarcat.
        const loadRatio = car_is_accelerating ? clamp(throttle * 0.72 + speedRatio * 0.28, 0, 1) : 0;

        // Daca masina inca se rostogoleste, RPM-ul sta putin peste idle.
        const rollingRPM = current_speed > 2 ? Math.min(550, current_speed * 7) : 0;

        targetRPM = car_is_accelerating
            ? idleRPM + (maxRPM - idleRPM) * loadRatio
            : idleRPM + rollingRPM;
    }

    const torque = Number(torqueSelectorElement.value);
    const totalWeight = getTotalCarWeight();

    // Motor cu cuplu mare + masina usoara = RPM-ul urca mai repede.
    const rpmUpSpeed = 1200 + (torque / totalWeight) * 9000;
    const rpmDownSpeed = car_is_on ? 2200 : 3200;
    const rpmStep = (targetRPM > current_rpm ? rpmUpSpeed : rpmDownSpeed) * deltaTime;

    current_rpm = moveTowards(current_rpm, targetRPM, rpmStep);
}

function updateSpeed(deltaTime, topSpeed) {
    // Aici se modifica viteza masinii.
    // In functie de stare: franeaza, accelereaza sau incetineste natural.
    const aeroRating = getAeroRating();
    const dragSlowdown = Math.pow(current_speed / Math.max(topSpeed, 1), 2) * (5.5 - aeroRating * 0.25);
    const rollingSlowdown = current_speed > 0 ? 0.55 : 0;

    if (car_is_braking) {
        current_speed -= (getBrakePower() + dragSlowdown + rollingSlowdown) * deltaTime;
    } else if (car_is_accelerating) {
        current_speed += calculateAccelerationPerSecond(topSpeed) * deltaTime;
    } else {
        current_speed -= (dragSlowdown + rollingSlowdown) * deltaTime;
    }

    current_speed = clamp(current_speed, 0, topSpeed);

    if (current_speed <= 0.05) {
        // Sub 0.05 km/h o consideram oprita complet, ca sa nu ramana valori gen 0.03.
        current_speed = 0;
        car_is_braking = false;

        if (!car_is_accelerating) {
            accelerateCarButton.textContent = "ACCELERATE";
        }
    }
}

function updateOilTemperature(deltaTime, topSpeed) {
    // Temperatura uleiului are o tinta, apoi se apropie incet de ea.
    // Tinta creste cand motorul e turat, cand apesi acceleratia si cand ai turbo.
    const maxRPM = Number(maxRPMRangerElement.value);
    const rpmRatio = clamp(current_rpm / maxRPM, 0, 1.25);
    const throttle = car_is_accelerating ? getThrottlePercent() : 0;
    const speedCooling = clamp(current_speed / Math.max(topSpeed, 1), 0, 1);
    const isLiquidCooled = coolingTypeSelectorElement.value === "liquid";

    // Racirea cu lichid este mai stabila.
    // Racirea pe aer depinde mai mult de viteza masinii.
    const coolingBonus = isLiquidCooled ? 14 + speedCooling * 7 : 5 + speedCooling * 14;
    const fuelBonus = combustibleTypeSelectorElement.value === "diesel" ? -3 : 4;
    const loadHeat = rpmRatio * 48 + throttle * 34 + getTurboHeatBonus() + fuelBonus;
    const targetTemperature = car_is_on
        ? clamp(58 + loadHeat - coolingBonus, 45, 165)
        : AMBIENT_TEMPERATURE;
    const responseSpeed = car_is_on ? 0.045 : 0.025;

    // In loc sa punem temperatura direct la tinta, o apropiem treptat.
    // De asta uleiul se incalzeste/raceste natural.
    current_oil_temperature += (targetTemperature - current_oil_temperature) * responseSpeed * deltaTime;
    current_oil_temperature = clamp(current_oil_temperature, MIN_OIL_TEMPERATURE, 170);
}

function updateWear(deltaTime) {
    // Uzura apare doar cand motorul merge efectiv.
    if (!car_is_on || current_rpm < 300) {
        return;
    }

    const maxRPM = Number(maxRPMRangerElement.value);
    const rpmRatio = clamp(current_rpm / maxRPM, 0, 1.35);
    const throttle = car_is_accelerating ? getThrottlePercent() : 0;

    // Fiecare bucata de uzura reprezinta un motiv diferit pentru care motorul se strica:
    // caldura mare, turatii mari, acceleratie puternica, turbo, sau motor fortat cand e rece.
    const heatWear = Math.max(0, current_oil_temperature - 105) * 0.00016;
    const coldWear = current_oil_temperature < 60 && current_rpm > getIdleRPM() + 650 ? 0.0011 : 0;
    const highRpmWear = Math.pow(Math.max(0, rpmRatio - 0.78), 2) * 0.019;
    const loadWear = throttle * 0.0018;
    const turboWear = turboTypeSelectorElement.value === "NA" ? 0 : Number(turboPressionSelectorElement.value) * 0.00022 * throttle;

    current_acumulated_wear += (0.00025 + heatWear + coldWear + highRpmWear + loadWear + turboWear) * deltaTime;
    current_acumulated_wear = clamp(current_acumulated_wear, 0, 100);
}

function updateMileage(deltaTime) {
    // Viteza este in km/h, iar deltaTime este in secunde.
    // Impartim la 3600 ca sa transformam secundele in ore.
    current_mileage += current_speed * (deltaTime / 3600);
}

function renderCurrentState() {
    // Aici impingem valorile calculate inapoi in pagina.
    // Simulatorul calculeaza cu zecimale, dar afisam frumos pentru utilizator.
    currentRPM.textContent = Math.round(current_rpm);
    currentSpeed.textContent = current_speed.toFixed(1);
    currentAcumulatedWear.textContent = current_acumulated_wear.toFixed(2);
    currentOilTemperature.textContent = current_oil_temperature.toFixed(0);
    currentMileage.textContent = current_mileage.toFixed(2);
}

function simulationTick() {
    // Aceasta este inima simulatorului.
    // Ruleaza o data la 50 ms si actualizeaza tot cate putin.
    const deltaTime = 0.05;
    const topSpeed = calculateTopSpeed();

    if (!car_is_on) {
        car_is_accelerating = false;
    }

    updateRPM(deltaTime, topSpeed);
    updateSpeed(deltaTime, topSpeed);
    updateOilTemperature(deltaTime, topSpeed);
    updateWear(deltaTime);
    updateMileage(deltaTime);
    renderCurrentState();
}

function startSimulationLoop() {
    // Pornim bucla o singura data.
    // Fara verificarea asta, fiecare click ar crea inca o bucla si simulatorul ar accelera aiurea.
    if (simulation_interval_id !== null) {
        return;
    }

    simulation_interval_id = window.setInterval(simulationTick, 50);
}

function refreshButtonStates() {
    // Textul butoanelor este doar o oglinda a starii interne.
    startEngineButton.textContent = car_is_on ? "STOP ENGINE" : "START ENGINE";

    if (car_is_braking) {
        accelerateCarButton.textContent = "BRAKING...";
    } else if (car_is_accelerating) {
        accelerateCarButton.textContent = "BRAKE";
    } else {
        accelerateCarButton.textContent = "ACCELERATE";
    }
}

function usingCar() {
    // Functia ramane aici ca nume compatibil cu vechea logica.
    // Acum doar se asigura ca simularea este pornita.
    startSimulationLoop();
}

function startCar() {
    // Butonul START/STOP:
    // - daca motorul e oprit, il porneste
    // - daca masina sta pe loc, il opreste
    // - daca masina merge, intai cere franare
    startSimulationLoop();

    if (!car_is_on) {
        car_is_on = true;
        car_is_braking = false;
        current_rpm = Math.max(current_rpm, 120);
        refreshButtonStates();
        return;
    }

    if (current_speed < 1) {
        car_is_on = false;
        car_is_accelerating = false;
        car_is_braking = false;
        refreshButtonStates();
        return;
    }

    car_is_accelerating = false;
    car_is_braking = true;
    refreshButtonStates();
}

function accelerateCar() {
    // Butonul ACCELERATE/BRAKE functioneaza ca un toggle.
    // Cand accelerezi si apesi iar, masina incepe sa franeze.
    startSimulationLoop();

    if (car_is_accelerating) {
        car_is_accelerating = false;
        car_is_braking = true;
        refreshButtonStates();
        return;
    }

    if (car_is_braking) {
        car_is_braking = false;
        refreshButtonStates();
        return;
    }

    if (car_is_on) {
        car_is_accelerating = true;
        car_is_braking = false;
    } else if (current_speed > 0) {
        car_is_braking = true;
    }

    refreshButtonStates();
}

function calculateEngineWeight() {
    // Greutatea motorului este estimata din cilindree + material + turbo + racire + tip motor.
    let material_bonus = 0.00;
    let turbo_system_bonus = 0.00;
    let cooling_type_bonus = 0.00;
    let engine_type_bonus = 0.00;

    if (engineMaterialSelectorElement.value === "iron") {
        material_bonus = 1.20;
    } else if (engineMaterialSelectorElement.value === "aluminium") {
        material_bonus = 0.85;
    }

    if (turboTypeSelectorElement.value === "turbo") {
        turbo_system_bonus = 10;
    } else if (turboTypeSelectorElement.value === "twin-turbo") {
        turbo_system_bonus = 15;
    }

    if (engineTypeSelectorElement.value === "inline") {
        engine_type_bonus = 10;
    } else if (engineTypeSelectorElement.value === "V Engine") {
        engine_type_bonus = 25;
    }

    if (coolingTypeSelectorElement.value === "liquid") {
        cooling_type_bonus = 15;
    } else if (coolingTypeSelectorElement.value === "air") {
        cooling_type_bonus = 0;
    }

    const engine_weight = (((Number(engineSizeSelectorElement.value) / 10) * material_bonus) + (turbo_system_bonus + cooling_type_bonus + engine_type_bonus)) * 0.55;

    return engine_weight.toFixed(2);
}

function calculateHorsePower() {
    // Formula este aproximativa, nu una de dyno real.
    // Scopul ei este sa dea rezultate credibile pentru gameplay.
    const torque = Number(torqueSelectorElement.value);
    const maxRPM = Number(maxRPMRangerElement.value);
    const engineSize = Number(engineSizeSelectorElement.value);
    const pressure = Number(turboPressionSelectorElement.value);
    const sizeFactor = clamp(0.78 + engineSize / 5200, 0.85, 2.2);
    const fuelFactor = combustibleTypeSelectorElement.value === "diesel" ? 0.92 : 1;
    const engineTypeFactor = engineTypeSelectorElement.value === "V Engine" ? 1.06 : 1;
    let turboBoost = 0;

    // Turbo-ul adauga cai putere peste formula de baza.
    if (turboTypeSelectorElement.value === "turbo") {
        turboBoost = 14 * pressure;
    } else if (turboTypeSelectorElement.value === "twin-turbo") {
        turboBoost = 24 * pressure;
    }

    return ((torque * maxRPM) / 7127) * sizeFactor * fuelFactor * engineTypeFactor + turboBoost;
}

function refreshSpecifications() {
    // Cand misti un slider sau schimbi un selector, actualizam textele din zona de specificatii.
    maxRPMRangerOutputElement.textContent = maxRPMRangerElement.value;
    combustibleTypeOutputElement.textContent = combustibleTypeSelectorElement.value;
    torqueOutputElement.textContent = torqueSelectorElement.value;
    coolingTypeOutputElement.textContent = coolingTypeSelectorElement.value;
    turboTypeOutputElement.textContent = turboTypeSelectorElement.value;
    turboPressionOutputElement.textContent = turboTypeSelectorElement.value === "NA"
        ? "0 (turbo not found)"
        : Number(turboPressionSelectorElement.value).toFixed(1);
    engineSizeOutputElement.textContent = engineSizeSelectorElement.value;
    engineMaterialOutputElement.textContent = engineMaterialSelectorElement.value;
    engineTypeOutputElement.textContent = engineTypeSelectorElement.value;
    carBodyWeightOutputElement.textContent = carBodyWeightSelectorElement.value;
    forcingCarProcentOutputElement.textContent = forcingCarProcentSelectorElement.value;
    carBodyAerodinamicsRatingOutputElement.textContent = carBodyAerodinamicsRatingSelectorElement.value;
    engineWeightOutputElement.textContent = calculateEngineWeight();
    horsePowerOutputElement.textContent = Number(calculateHorsePower()).toFixed(0);
}

function applyFuelLimits() {
    // Diesel-ul nu este lasat sa urce la acelasi RPM maxim ca benzina.
    // Daca era setat peste limita, il coboram automat.
    if (combustibleTypeSelectorElement.value === "diesel") {
        maxRPMRangerElement.max = 5000;

        if (Number(maxRPMRangerElement.value) > 5000) {
            maxRPMRangerElement.value = 4500;
        }
    } else {
        maxRPMRangerElement.max = 10000;
    }
}

function onSpecificationChanged() {
    // Aceasta functie este chemata de toate controalele din pagina.
    // Intai aplica reguli speciale, apoi redeseneaza specificatiile.
    applyFuelLimits();
    refreshSpecifications();
}

// Pentru slidere folosim "input", fiindca vrem actualizare live in timp ce le misti.
[
    maxRPMRangerElement,
    torqueSelectorElement,
    turboPressionSelectorElement,
    engineSizeSelectorElement,
    carBodyWeightSelectorElement,
    forcingCarProcentSelectorElement,
    carBodyAerodinamicsRatingSelectorElement,
].forEach((element) => {
    element.addEventListener("input", onSpecificationChanged);
});

// Pentru select-uri folosim "change", fiindca valoarea se schimba cand alegi alta optiune.
[
    combustibleTypeSelectorElement,
    coolingTypeSelectorElement,
    turboTypeSelectorElement,
    engineMaterialSelectorElement,
    engineTypeSelectorElement,
    brakeTypeSelectorElement,
].forEach((element) => {
    element.addEventListener("change", onSpecificationChanged);
});

// Initializam textele din pagina cand se incarca scriptul.
onSpecificationChanged();
renderCurrentState();
