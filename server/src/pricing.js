export const PRICING = {
  eco:    { base: 35, perKm: 12, perMin: 1.2, minPrice: 70 },
  comfort:{ base: 45, perKm: 15, perMin: 1.4, minPrice: 90 },
  van:    { base: 55, perKm: 18, perMin: 1.6, minPrice: 110 },
};

export const COEFF = {
  night: 1.2,   // 22:00–06:00
  rain:  1.1,
  snow:  1.2,
};

export function estimate({km, minutes, klass='eco', isNight=false, weather='clear'}){
  const p = PRICING[klass] || PRICING.eco;
  let price = p.base + km * p.perKm + minutes * p.perMin;
  if(isNight) price *= COEFF.night;
  if(weather==='rain') price *= COEFF.rain;
  if(weather==='snow') price *= COEFF.snow;
  if(price < p.minPrice) price = p.minPrice;
  return Math.round(price);
}