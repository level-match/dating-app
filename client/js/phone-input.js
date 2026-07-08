/* LEVEL — intl-tel-input wrapper for MFA phone entry (E.164 + validation) */

import intlTelInput from 'intl-tel-input/intlTelInputWithUtils'
import 'intl-tel-input/styles'

let iti = null

export function initPhoneInput(inputEl) {
  if (!inputEl) return null
  if (iti) return iti

  iti = intlTelInput(inputEl, {
    initialCountry: 'auto',
    geoIpLookup: (success) => {
      fetch('https://ipapi.co/json/')
        .then((r) => r.json())
        .then((d) => success((d.country_code || 'us').toLowerCase()))
        .catch(() => success('us'))
    },
    separateDialCode: true,
    countrySearch: true,
    formatAsYouType: true,
    nationalMode: false,
    autoPlaceholder: 'aggressive',
    validationNumberTypes: ['MOBILE'],
  })

  return iti
}

export function getPhoneE164() {
  if (!iti) return ''
  return iti.getNumber() || ''
}

export function isPhoneValid() {
  if (!iti) return false
  return iti.isValidNumber()
}

export function setPhoneNumber(number) {
  if (!iti || !number) return
  iti.setNumber(number)
}
