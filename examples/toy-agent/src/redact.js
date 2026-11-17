// Customer contact details never reach the model.

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

export function redactCustomer(text) {
  return text.replace(EMAIL, '[email]').replace(PHONE, '[phone]');
}
