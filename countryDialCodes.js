// countryDialCodes.js
// Tento súbor obsahuje globálny zoznam predvolieb pre formátovanie telefónnych čísel.

// Zoznam predvolieb, zoradený zostupne podľa dĺžky pre správne rozpoznávanie
// Pripojenie tohto súboru do <head> HTML súboru sprístupní tento zoznam globálne.
const countryDialCodes = [
    { code: 'US', dialCode: '+1' }, { code: 'CA', dialCode: '+1' }, { code: 'RU', dialCode: '+7' },
    { code: 'EG', dialCode: '+20' }, { code: 'ZA', dialCode: '+27' }, { code: 'GR', dialCode: '+30' },
    { code: 'NL', dialCode: '+31' }, { code: 'BE', dialCode: '+32' }, { code: 'FR', dialCode: '+33' },
    { code: 'ES', dialCode: '+34' }, { code: 'GI', dialCode: '+350' }, { code: 'PT', dialCode: '+351' },
    { code: 'IE', dialCode: '+353' }, { code: 'IS', dialCode: '+354' }, { code: 'AL', dialCode: '+355' },
    { code: 'MT', dialCode: '+356' }, { code: 'CY', dialCode: '+357' }, { code: 'FI', dialCode: '+358' },
    { code: 'BG', dialCode: '+359' }, { code: 'LT', dialCode: '+370' }, { code: 'LV', dialCode: '+371' },
    { code: 'EE', dialCode: '+372' }, { code: 'MD', dialCode: '+373' }, { code: 'AM', dialCode: '+374' },
    { code: 'BY', dialCode: '+375' }, { code: 'AD', dialCode: '+376' }, { code: 'MC', dialCode: '+377' },
    { code: 'SM', dialCode: '+378' }, { code: 'UA', dialCode: '+380' }, { code: 'RS', dialCode: '+381' },
    { code: 'ME', dialCode: '+382' }, { code: 'HR', dialCode: '+385' }, { code: 'SI', dialCode: '+386' },
    { code: 'BA', dialCode: '+387' }, { code: 'SK', dialCode: '+421' }, { code: 'CZ', dialCode: '+420' },
    { code: 'LI', dialCode: '+423' }, { code: 'AT', dialCode: '+43' }, { code: 'GB', dialCode: '+44' },
    { code: 'DK', dialCode: '+45' }, { code: 'SE', dialCode: '+46' }, { code: 'NO', dialCode: '+47' },
    { code: 'PL', dialCode: '+48' }, { code: 'DE', dialCode: '+49' }, { code: 'PE', dialCode: '+51' },
    { code: 'MX', dialCode: '+52' }, { code: 'CU', dialCode: '+53' }, { code: 'AR', dialCode: '+54' },
    { code: 'BR', dialCode: '+55' }, { code: 'CL', dialCode: '+56' }, { code: 'CO', dialCode: '+57' },
    { code: 'VE', dialCode: '+58' }, { code: 'MY', dialCode: '+60' }, { code: 'AU', dialCode: '+61' },
    { code: 'ID', dialCode: '+62' }, { code: 'PH', dialCode: '+63' }, { code: 'NZ', dialCode: '+64' },
    { code: 'SG', dialCode: '+65' }, { code: 'TH', dialCode: '+66' }, { code: 'TZ', dialCode: '+255' },
    { code: 'KE', dialCode: '+254' }, { code: 'ZM', dialCode: '+260' }, { code: 'ZW', dialCode: '+263' },
    { code: 'NG', dialCode: '+234' }, { code: 'GH', dialCode: '+233' }, { code: 'MA', dialCode: '+212' },
    { code: 'DZ', dialCode: '+213' }, { code: 'TR', dialCode: '+90' }, { code: 'JP', dialCode: '+81' },
    { code: 'KR', dialCode: '+82' }, { code: 'CN', dialCode: '+86' }, { code: 'IN', dialCode: '+91' },
    { code: 'IR', dialCode: '+98' }, { code: 'AF', dialCode: '+93' }, { code: 'DZ', dialCode: '+213' },
    { code: 'AO', dialCode: '+244' }, { code: 'BJ', dialCode: '+229' }, { code: 'BW', dialCode: '+267' },
    { code: 'BF', dialCode: '+226' }, { code: 'BI', dialCode: '+257' }, { code: 'CM', dialCode: '+237' },
    { code: 'CV', dialCode: '+238' }, { code: 'CF', dialCode: '+236' }, { code: 'TD', dialCode: '+235' },
    { code: 'KM', dialCode: '+269' }, { code: 'CG', dialCode: '+242' }, { code: 'CD', dialCode: '+243' },
    { code: 'CI', dialCode: '+225' }, { code: 'DJ', dialCode: '+253' }, { code: 'GQ', dialCode: '+240' },
    { code: 'ER', dialCode: '+291' }, { code: 'ET', dialCode: '+251' }, { code: 'GA', dialCode: '+241' },
    { code: 'GM', dialCode: '+220' }, { code: 'GN', dialCode: '+224' }, { code: 'GW', dialCode: '+245' },
    { code: 'KE', dialCode: '+254' }, { code: 'LS', dialCode: '+266' }, { code: 'LR', dialCode: '+231' },
    { code: 'LY', dialCode: '+218' }, { code: 'MG', dialCode: '+261' }, { code: 'MW', dialCode: '+265' },
    { code: 'ML', dialCode: '+223' }, { code: 'MR', dialCode: '+222' }, { code: 'MU', dialCode: '+230' },
    { code: 'YT', dialCode: '+262' }, { code: 'MZ', dialCode: '+258' }, { code: 'NA', dialCode: '+264' },
    { code: 'NE', dialCode: '+227' }, { code: 'NG', dialCode: '+234' }, { code: 'RW', dialCode: '+250' },
    { code: 'SH', dialCode: '+290' }, { code: 'ST', dialCode: '+239' }, { code: 'SN', dialCode: '+221' },
    { code: 'SC', dialCode: '+248' }, { code: 'SL', dialCode: '+232' }, { code: 'SO', dialCode: '+252' },
    { code: 'ZA', dialCode: '+27' }, { code: 'SS', dialCode: '+211' }, { code: 'SD', dialCode: '+249' },
    { code: 'SZ', dialCode: '+268' }, { code: 'TZ', dialCode: '+255' }, { code: 'TG', dialCode: '+228' },
    { code: 'TN', dialCode: '+216' }, { code: 'UG', dialCode: '+256' }, { code: 'EH', dialCode: '+212' },
    { code: 'ZM', dialCode: '+260' }, { code: 'ZW', dialCode: '+263' }
];

// Export pre možnosť načítania v HTML
window.countryDialCodes = countryDialCodes;
