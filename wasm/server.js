import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import { vinDecoder } from './src/services/vindecoder.js';
import { executeStepApiActions, executeFieldApiActions } from './src/services/apiTasks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================================
// NLP PROCESSOR LOGIC (Moved from client)
// ============================================================

const serverStorage = new Map();

function getLanguage() {
  return globalThis.currentLanguage || 'en';
}

function getLocalized(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object' && obj !== null) {
    const lang = getLanguage();
    return obj[lang] !== undefined && obj[lang] !== '' ? obj[lang] : obj.en || '';
  }
  return obj;
}

function getLocalizedOptions(optionsObj) {
  if (!optionsObj) return [];
  if (Array.isArray(optionsObj)) return optionsObj;
  if (typeof optionsObj === 'object' && optionsObj !== null) {
    const lang = getLanguage();
    return optionsObj[lang] || optionsObj.en || [];
  }
  return optionsObj;
}

const DEFAULT_SERVICES = {
  iftms: {
    id: 'iftms',
    name: { en: 'IFTMS - Freight Transport', am: 'IFTMS - የጭነት ትራንስፖርት' },
    description: { en: 'Register freight transport operators, vehicles, and drivers', am: 'የጭነት ትራንስፖርት ኦፕሬተሮችን፣ ተሽከርካሪዎችን እና አሽከርካሪዎችን ይመዝገቡ' },
    initStep: 1,
    collectedData: { operator: {}, vehicles: [], drivers: [] },
    steps: {
      1: {
        type: 'form',
        title: { en: 'Operator Registration', am: 'የኦፕሬተር ምዝገባ' },
        fields: [
          { name: 'businessLicenseNumber', question: { en: 'Business License Number?', am: 'የንግድ ፈቃድ ቁጥር?' }, validation: 'license', regex: /^[0-9]{6,10}$/, example: { en: '12345678', am: '12345678' }, error: { en: 'Invalid. Use 6-10 digits.', am: 'ልክ ያልሆነ።' } },
          { name: 'operatorName', question: { en: 'Operator Name?', am: 'የኦፕሬተር ስም?' }, validation: 'text', regex: /^.+$/, example: { en: 'Ethio Transport', am: 'ኢትዮ ትራንስፖርት' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' } },
          { name: 'phoneNumber', question: { en: 'Phone Number?', am: 'ስልክ ቁጥር?' }, validation: 'phone', regex: /^(0?[79][0-9]{8}|\+251[79][0-9]{8})$/, example: { en: '0912345678', am: '0912345678' }, error: { en: 'Invalid phone number.', am: 'ልክ ያልሆነ ስልክ ቁጥር።' } },
          { name: 'password', question: { en: 'IFMTS Password?', am: 'IFMTS ይለፍ ቃል?' }, validation: 'text', example: { en: 'your_password', am: 'ይለፍ_ቃልዎ' }, error: { en: 'Password is required.', am: 'ይለፍ ቃል ያስፈልጋል።' } }
        ],
        onValid: { nextStep: 2 }
      },
      2: {
        type: 'subprocess',
        title: { en: 'Vehicle Management', am: 'የተሽከርካሪ አስተዳደር' },
        subprocess: {
          itemName: { en: 'Vehicle', am: 'ተሽከርካሪ' },
          addPrompt: { en: 'Add a vehicle? (yes/no)', am: 'ተሽከርካሪ ማከል ይፈልጋሉ? (አዎ/አይ)' },
          continuePrompt: { en: 'Continue to drivers? (yes/no)', am: 'ወደ አሽከርካሪዎች መቀጠል? (አዎ/አይ)' },
          fields: [
            { name: 'plateNumber', question: { en: 'Plate Number?', am: 'የሰሌዳ ቁጥር?' }, validation: 'plate', regex: /^[A-Z]{2,3}-?[0-9]{3,4}$/i, example: { en: 'AA-1234', am: 'AA-1234' }, error: { en: 'Invalid plate format.', am: 'ልክ ያልሆነ የሰሌዳ ቅርጸት።' } },
            { name: 'vinNumber', question: { en: 'VIN Number?', am: 'VIN ቁጥር?' }, validation: 'vin', regex: /^[A-HJ-NPR-Z0-9]{10,18}$/i, example: { en: 'LVBS6PE123456789', am: 'LVBS6PE123456789' }, error: { en: 'Invalid VIN.', am: 'ልክ ያልሆነ VIN።' } },
            { name: 'manufacturer', question: { en: 'Manufacturer?', am: 'አምራች?' }, validation: 'text', example: { en: 'Toyota', am: 'ቶዮታ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'vehicleModel', question: { en: 'Vehicle Model?', am: 'ሞዴል?' }, validation: 'text', example: { en: 'Hilux', am: 'ሃይሉክስ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'manufactureYear', question: { en: 'Year?', am: 'ዓመት?' }, validation: 'year', regex: /^(19|20)[0-9]{2}$/, example: { en: '2020', am: '2020' }, error: { en: 'Invalid year.', am: 'ልክ ያልሆነ ዓመት።' }, autoFill: true },
            { name: 'vehicleType', question: { en: 'Vehicle Type?', am: 'አይነት?' }, validation: 'text', example: { en: 'Truck', am: 'ጭነት መኪና' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'fuelType', question: { en: 'Fuel Type?', am: 'የነዳጅ አይነት?' }, validation: 'choice', options: { en: ['Diesel', 'Petrol', 'Electric'], am: ['ናፍጣ', 'ቤንዚን', 'ኤሌክትሪክ'] }, example: { en: 'Diesel', am: 'ናፍጣ' }, error: { en: 'Select fuel type.', am: 'የነዳጅ አይነት ይምረጡ።' }, autoFill: true }
          ],
          onValid: { nextStep: 3, collectionKey: 'vehicles' }
        }
      },
      3: {
        type: 'subprocess',
        title: { en: 'Driver Management', am: 'የአሽከርካሪ አስተዳደር' },
        subprocess: {
          itemName: { en: 'Driver', am: 'አሽከርካሪ' },
          addPrompt: { en: 'Add a driver? (yes/no)', am: 'አሽከርካሪ ማከል ይፈልጋሉ? (አዎ/አይ)' },
          continuePrompt: { en: 'Continue? (yes/no)', am: 'መቀጠል? (አዎ/አይ)' },
          fields: [
            { name: 'driverName', question: { en: 'Driver Name?', am: 'የአሽከርካሪ ስም?' }, validation: 'text', example: { en: 'Abebe Kebede', am: 'አበበ ከበደ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' } },
            { name: 'driverLicense', question: { en: 'Driver License?', am: 'መንጃ ፈቃድ?' }, validation: 'text', example: { en: 'DL123456', am: 'DL123456' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' } }
          ],
          onValid: { nextStep: 4, collectionKey: 'drivers' }
        }
      },
      4: {
        type: 'summary',
        title: { en: 'Complete', am: 'ተጠናቀቀ' },
        isFinal: true,
        actions: { en: ['Download', 'Print', 'New'], am: ['አውርድ', 'አትም', 'አዲስ'] }
      }
    }
  },
  documentAnalysis: {
    id: 'documentAnalysis',
    name: { en: 'Document Analysis', am: 'የሰነድ ትንተና' },
    description: { en: 'Analyze documents', am: 'ሰነዶችን ይተንትኑ' },
    initStep: 1,
    collectedData: { document: null, analysisType: null },
    steps: {
      1: {
        type: 'file_upload',
        title: { en: 'Upload Document', am: 'ሰነድ ስቀል' },
        prompt: { en: 'Upload document:', am: 'ሰነድ ያስገቡ:' },
        onValid: { nextStep: 2 }
      },
      2: {
        type: 'form',
        title: { en: 'Analysis Type', am: 'የትንተና አይነት' },
        fields: [
          { name: 'analysisType', question: { en: 'Analysis type?', am: 'የትንተና አይነት?' }, validation: 'choice', options: { en: ['Summarize', 'Extract'], am: ['ማጠቃለል', 'ማውጣት'] }, example: { en: 'Summarize', am: 'ማጠቃለል' }, error: { en: 'Select option.', am: 'አማራጭ ይምረጡ።' } }
        ],
        onValid: { nextStep: 3 }
      },
      3: {
        type: 'result',
        title: { en: 'Result', am: 'ውጤት' },
        isFinal: true,
        actions: { en: ['New', 'Export'], am: ['አዲስ', 'ወደ ውጭ'] }
      }
    }
  },
  videoGeneration: {
    id: 'videoGeneration',
    name: { en: 'Video Generation', am: 'ቪዲዮ ማምረት' },
    description: { en: 'Create videos', am: 'ቪዲዮዎችን ይፍጠሩ' },
    initStep: 1,
    collectedData: { videoType: null },
    steps: {
      1: {
        type: 'form',
        title: { en: 'Video Details', am: 'የቪዲዮ ዝርዝሮች' },
        fields: [
          { name: 'videoType', question: { en: 'Video type?', am: 'የቪዲዮ አይነት?' }, validation: 'choice', options: { en: ['Slideshow', 'Clip'], am: ['ስላይድሾው', 'ክሊፕ'] }, example: { en: 'Slideshow', am: 'ስላይድሾው' }, error: { en: 'Select type.', am: 'አይነት ይምረጡ።' } }
        ],
        onValid: { nextStep: 2 }
      },
      2: {
        type: 'summary',
        title: { en: 'Complete', am: 'ተጠናቀቀ' },
        isFinal: true,
        actions: { en: ['Generate'], am: ['አምርት'] }
      }
    }
  }
};

let currentService = 'iftms';
let services = {};
let servicesInitialized = false;
const serviceStates = {};

function isServiceComplete(serviceId) {
  return serviceStates[serviceId]?.isComplete === true;
}

function markServiceComplete(serviceId) {
  if (!serviceStates[serviceId]) {
    const svc = services[serviceId];
    serviceStates[serviceId] = {
      currentStep: svc?.initStep || 1,
      currentFieldIndex: 0,
      waitingForAdd: false,
      waitingForContinue: false,
      currentItem: {},
      collectedData: JSON.parse(JSON.stringify(svc?.collectedData || {})),
      isComplete: true
    };
  } else {
    serviceStates[serviceId].isComplete = true;
  }
}

function resetService(serviceId) {
  const svc = services[serviceId];
  if (!svc) return;
  serviceStates[serviceId] = {
    currentStep: svc.initStep || 1,
    currentFieldIndex: 0,
    waitingForAdd: false,
    waitingForContinue: false,
    currentItem: {},
    collectedData: JSON.parse(JSON.stringify(svc.collectedData || {})),
    isComplete: false
  };
}

async function initializeServices() {
  if (servicesInitialized) return true;
  services = JSON.parse(JSON.stringify(DEFAULT_SERVICES));
  for (const [id, svc] of Object.entries(services)) {
    if (!serviceStates[id]) {
      serviceStates[id] = {
        currentStep: svc.initStep || 1,
        currentFieldIndex: 0,
        waitingForAdd: false,
        waitingForContinue: false,
        currentItem: {},
        collectedData: JSON.parse(JSON.stringify(svc.collectedData || {})),
        isComplete: false
      };
    }
  }
  servicesInitialized = true;
  return true;
}

function getState() {
  if (!serviceStates[currentService]) {
    const svc = services[currentService] || DEFAULT_SERVICES.iftms;
    serviceStates[currentService] = {
      currentStep: svc.initStep || 1,
      currentFieldIndex: 0,
      waitingForAdd: false,
      waitingForContinue: false,
      currentItem: {},
      collectedData: JSON.parse(JSON.stringify(svc.collectedData || {})),
      isComplete: false
    };
  }
  return serviceStates[currentService];
}

function getService() {
  return services[currentService] || DEFAULT_SERVICES.iftms;
}

function getStep() {
  const svc = getService();
  const state = getState();
  return svc?.steps?.[state.currentStep] || null;
}

function getCurrentField() {
  const step = getStep();
  const state = getState();
  const fields = step?.subprocess?.fields || step?.fields || [];
  return fields[state.currentFieldIndex] || null;
}

const SERVICE_KEYWORDS = {
  videoGeneration: ['video', 'clip', 'slideshow'],
  documentAnalysis: ['analyze', 'analysis', 'document'],
  iftms: ['freight', 'transport', 'iftms', 'vehicle', 'driver']
};

function checkServiceSwitch(message) {
  if (!message) return null;
  const lower = message.toLowerCase();
  for (const [serviceId, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return serviceId;
  }
  return null;
}

const YES_WORDS = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'አዎ'];
const NO_WORDS = ['no', 'nope', 'nah', 'skip', 'አይ'];

function checkYesNo(message) {
  if (!message) return null;
  const lower = message.trim().toLowerCase();
  if (YES_WORDS.some(w => lower === w || lower.startsWith(w + ' '))) return 'yes';
  if (NO_WORDS.some(w => lower === w || lower.startsWith(w + ' '))) return 'no';
  return null;
}

function validateField(input, field) {
  const value = input?.toString().trim();
  const errorMsg = getLocalized(field.error);
  if (!value) return { valid: false, message: errorMsg || 'Cannot be empty' };
  if (field.validation === 'choice' && field.options) {
    const options = getLocalizedOptions(field.options);
    const match = options.find(opt => opt.toLowerCase() === value.toLowerCase());
    if (match) return { valid: true, value: match };
    return { valid: false, message: `${errorMsg || 'Choose from:'} ${options.join(', ')}` };
  }
  if (field.regex && !field.regex.test(value)) {
    return { valid: false, message: errorMsg || 'Invalid input' };
  }
  return { valid: true, value };
}

function saveToState(fieldName, value) {
  const state = getState();
  const step = getStep();
  if (step?.type === 'form') {
    if (!state.collectedData.operator) state.collectedData.operator = {};
    state.collectedData.operator[fieldName] = value;
  } else if (step?.subprocess) {
    state.currentItem[fieldName] = value;
  }
}

function processVIN(input) {
  try {
    if (!input || !vinDecoder || typeof vinDecoder.isVIN !== 'function') return null;
    if (!vinDecoder.isVIN(input)) return null;
    const vin = input.trim().toUpperCase();
    if (typeof vinDecoder.getCompleteVehicleData === 'function') {
      return vinDecoder.getCompleteVehicleData(vin);
    }
    return { vinNumber: vin, manufacturer: 'Unknown', vehicleModel: 'Unknown', manufactureYear: 'Unknown' };
  } catch (error) {
    return null;
  }
}

function isAutoFillField(field) {
  return field && field.autoFill === true;
}

async function stepIntro() {
  const step = getStep();
  const state = getState();
  
  if (!step) {
    const text = getLocalized({ en: 'How can I help?', am: 'እንዴት ልረዳ?' });
    return { text, html: `<div>${text}</div>`, isStructured: true };
  }

  if (isServiceComplete(currentService) || step.isFinal || step.type === 'summary' || step.type === 'result') {
    markServiceComplete(currentService);
    return await buildComplete();
  }

  if (step.type === 'file_upload') {
    const prompt = getLocalized(step.prompt);
    return { text: prompt, html: `<div>${prompt}</div>`, isStructured: true };
  }

  if (step.subprocess?.fields) {
    const fields = step.subprocess.fields;
    let firstNonAutoFillIndex = fields.findIndex(f => !isAutoFillField(f));
    if (firstNonAutoFillIndex === -1) firstNonAutoFillIndex = 0;
    state.waitingForAdd = true;
    state.currentFieldIndex = firstNonAutoFillIndex;
    const firstField = fields[firstNonAutoFillIndex];
    const question = getLocalized(firstField.question);
    return { text: question, html: `<div>${question}</div>`, isStructured: true };
  }

  const firstField = step.fields?.[0];
  if (firstField) {
    const question = getLocalized(firstField.question);
    return { text: question, html: `<div>${question}</div>`, isStructured: true };
  }

  const prompt = getLocalized(step.prompt) || getLocalized({ en: 'How can I help?', am: 'እንዴት ልረዳ?' });
  return { text: prompt, html: `<div>${prompt}</div>`, isStructured: true };
}

async function buildComplete() {
  const state = getState();
  const svc = getService();
  let summary = `${getLocalized(svc.name)} Complete!\n\n`;
  for (const [key, val] of Object.entries(state.collectedData)) {
    if (!val) continue;
    summary += `${key.toUpperCase()}:\n`;
    if (Array.isArray(val)) {
      val.forEach((item, i) => {
        summary += `  ${i + 1}. ${Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      });
    } else if (typeof val === 'object') {
      Object.entries(val).forEach(([k, v]) => { summary += `  • ${k}: ${v}\n`; });
    }
  }
  return { text: summary, html: `<div><pre>${summary}</pre></div>`, isStructured: true, isComplete: true, serviceId: currentService };
}

async function executeAction(action, rawValue, originalMessage) {
  const state = getState();
  const step = getStep();
  const currentField = getCurrentField();

  if (!step) {
    const text = getLocalized({ en: 'System error', am: 'ስህተት' });
    return { text, html: `<div>${text}</div>`, isStructured: true };
  }

  if (!originalMessage?.trim()) {
    if (currentField) {
      const question = getLocalized(currentField.question);
      return { text: question, html: `<div>${question}</div>`, isStructured: true };
    }
    const text = getLocalized({ en: 'Please enter a value.', am: 'እሴት ያስገቡ።' });
    return { text, html: `<div>${text}</div>`, isStructured: true };
  }

  switch (action) {
    case 'save': {
      if (!currentField) {
        const text = getLocalized({ en: 'I received:', am: 'ተቀብያለሁ:' }) + ' ' + originalMessage;
        return { text, html: `<div>${text}</div>`, isStructured: true };
      }

      if (currentField.name === 'vinNumber' || currentField.name === 'chassisNumber') {
        const vinResult = processVIN(originalMessage);
        if (vinResult) {
          saveToState('vinNumber', vinResult.vinNumber || originalMessage.trim().toUpperCase());
          state.currentFieldIndex++;
          const fields = step.subprocess?.fields || [];
          let autoFilledCount = 0;
          for (const field of fields) {
            if (isAutoFillField(field)) {
              const fieldValue = vinResult[field.name];
              if (fieldValue && fieldValue !== 'Unknown') {
                saveToState(field.name, fieldValue);
                state.currentFieldIndex++;
                autoFilledCount++;
              }
            }
          }
          while (state.currentFieldIndex < fields.length && isAutoFillField(fields[state.currentFieldIndex])) {
            state.currentFieldIndex++;
          }
          if (state.currentFieldIndex >= fields.length && step.subprocess) {
            const key = step.subprocess.onValid.collectionKey;
            state.collectedData[key].push({ ...state.currentItem });
            state.currentItem = {};
            state.currentFieldIndex = 0;
            state.waitingForAdd = true;
            const addPrompt = getLocalized(step.subprocess.addPrompt);
            return { text: addPrompt, html: `<div>✅ ${autoFilledCount} fields auto-filled<br>${addPrompt}</div>`, isStructured: true };
          }
          const nextField = getCurrentField();
          const nextQuestion = nextField ? getLocalized(nextField.question) : '';
          return { text: nextQuestion, html: `<div>✅ VIN processed<br>${nextQuestion}</div>`, isStructured: true };
        }
      }

      const validation = validateField(rawValue || originalMessage, currentField);
      if (!validation.valid) {
        return { text: validation.message, html: `<div>❌ ${validation.message}</div>`, isStructured: true };
      }
      
      saveToState(currentField.name, validation.value);
      state.currentFieldIndex++;
      const fields = step.subprocess?.fields || step.fields || [];
      
      while (state.currentFieldIndex < fields.length && isAutoFillField(fields[state.currentFieldIndex])) {
        state.currentFieldIndex++;
      }

      if (state.currentFieldIndex >= fields.length) {
        if (step.subprocess) {
          if (Object.keys(state.currentItem).length > 0) {
            const key = step.subprocess.onValid.collectionKey;
            state.collectedData[key].push({ ...state.currentItem });
            state.currentItem = {};
          }
          state.currentFieldIndex = 0;
          state.waitingForAdd = true;
          const addPrompt = getLocalized(step.subprocess.addPrompt);
          return { text: addPrompt, html: `<div>✅ Saved<br>${addPrompt}</div>`, isStructured: true };
        } else {
          state.currentStep = step.onValid?.nextStep || state.currentStep + 1;
          state.currentFieldIndex = 0;
          return await stepIntro();
        }
      }

      const nextField = getCurrentField();
      const nextQuestion = nextField ? getLocalized(nextField.question) : '';
      return { text: nextQuestion, html: `<div>✅ Saved<br>${nextQuestion}</div>`, isStructured: true };
    }

    case 'yes': {
      if (state.waitingForAdd) {
        state.waitingForAdd = false;
        state.currentItem = {};
        state.currentFieldIndex = 0;
        const firstField = step.subprocess.fields[0];
        const question = getLocalized(firstField.question);
        return { text: question, html: `<div>${question}</div>`, isStructured: true };
      }
      if (state.waitingForContinue) {
        state.waitingForContinue = false;
        state.currentStep = step.subprocess.onValid.nextStep;
        state.currentFieldIndex = 0;
        return await stepIntro();
      }
      break;
    }

    case 'no': {
      if (state.waitingForAdd) {
        state.waitingForAdd = false;
        state.waitingForContinue = true;
        const continuePrompt = getLocalized(step.subprocess.continuePrompt);
        return { text: continuePrompt, html: `<div>${continuePrompt}</div>`, isStructured: true };
      }
      if (state.waitingForContinue) {
        state.waitingForContinue = false;
        state.currentStep = step.subprocess?.onValid?.nextStep || state.currentStep + 1;
        state.currentFieldIndex = 0;
        return await stepIntro();
      }
      break;
    }

    case 'help': {
      const list = Object.values(services).map(s => `• ${getLocalized(s.name)}: ${getLocalized(s.description)}`).join('\n');
      return { text: `Available services:\n${list}`, html: `<div>${list.replace(/\n/g, '<br>')}</div>`, isStructured: true };
    }

    case 'status': {
      const collected = Object.entries(state.collectedData)
        .filter(([, v]) => v && (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0))
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length + ' items' : '✓'}`)
        .join(', ') || 'nothing yet';
      const svc = getService();
      const serviceName = getLocalized(svc.name);
      return { text: `${serviceName} | Step: ${state.currentStep} | ${collected}`, html: `<div>📊 ${serviceName}<br>Step: ${state.currentStep}<br>${collected}</div>`, isStructured: true };
    }

    case 'complete': {
      return await buildComplete();
    }

    default: {
      const text = getLocalized({ en: 'I understood:', am: 'ተረድቻለሁ:' }) + ' ' + originalMessage;
      return { text, html: `<div>${text}</div>`, isStructured: true };
    }
  }

  if (currentField) {
    const question = getLocalized(currentField.question);
    return { text: question, html: `<div>${question}</div>`, isStructured: true };
  }
  const text = getLocalized({ en: 'How can I help?', am: 'እንዴት ልረዳ?' });
  return { text, html: `<div>${text}</div>`, isStructured: true };
}

async function processMessage(message, file) {
  await initializeServices();

  if (file) {
    const step = getStep();
    if (step?.type === 'file_upload') {
      const state = getState();
      state.collectedData.document = { name: file.name, size: file.size };
      state.currentStep = step.onValid.nextStep;
      state.currentFieldIndex = 0;
      const text = getLocalized({ en: 'File received:', am: 'ፋይል ተቀብሏል:' }) + ' ' + file.name;
      return { text, html: `<div>📄 ${text}</div>`, isStructured: true };
    }
    return { text: 'File received', html: '<div>📎 File received</div>', isStructured: false };
  }

  if (!message) return await stepIntro();

  const switchTarget = checkServiceSwitch(message);
  if (switchTarget && switchTarget !== currentService && services[switchTarget]) {
    currentService = switchTarget;
    if (!serviceStates[switchTarget]) {
      serviceStates[switchTarget] = {
        currentStep: services[switchTarget].initStep || 1,
        currentFieldIndex: 0,
        waitingForAdd: false,
        waitingForContinue: false,
        currentItem: {},
        collectedData: JSON.parse(JSON.stringify(services[switchTarget].collectedData || {})),
        isComplete: false
      };
    }
    const serviceName = getLocalized(services[switchTarget].name);
    const serviceDesc = getLocalized(services[switchTarget].description);
    return { text: `Welcome to ${serviceName}`, html: `<div>🔄 Welcome to ${serviceName}<br>${serviceDesc}</div>`, isStructured: true };
  }

  const state = getState();
  if (state.waitingForAdd || state.waitingForContinue) {
    const yesno = checkYesNo(message);
    if (yesno) return await executeAction(yesno, null, message);
  }

  const msgLower = message.toLowerCase();
  if (msgLower.includes('help')) return await executeAction('help', null, message);
  if (msgLower.includes('status')) return await executeAction('status', null, message);
  if (msgLower.includes('complete') || msgLower.includes('done')) return await executeAction('complete', null, message);

  const currentField = getCurrentField();
  if (currentField) {
    const validation = validateField(message, currentField);
    if (validation.valid) return await executeAction('save', validation.value, message);
    return { text: validation.message, html: `<div>❌ ${validation.message}</div>`, isStructured: true };
  }

  const text = getLocalized({ en: 'I received:', am: 'ተቀብያለሁ:' }) + ' ' + message;
  return { text, html: `<div>${text}</div>`, isStructured: true };
}

// ============================================================
// API ENDPOINTS
// ============================================================

app.post('/api/chat', async (req, res) => {
  try {
    const { message, file } = req.body;
    const response = await processMessage(message, file);
    res.json(response);
  } catch (error) {
    res.status(500).json({ text: `Error: ${error.message}`, html: `<div>❌ ${error.message}</div>`, isStructured: true });
  }
});

app.get('/api/services', async (req, res) => {
  await initializeServices();
  res.json(Object.values(services));
});

app.post('/api/services/reset', (req, res) => {
  const { serviceId } = req.body;
  resetService(serviceId);
  res.json({ success: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================================
// VITE DEV SERVER
// ============================================================

if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});