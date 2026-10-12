import { Module } from '../lib/plugins.js';

const fetchJSON = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': '❦𝐏𝚄𝙸 ꔫ 𝐏𝚄ɪɪɪᝰ.ᐟ 𝖃ꪑ∂/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

Module({
  command: 'weather',
  aliases: ['weather2', 'weatherinfo'],
  package: 'info',
  description: 'Current weather forecast'
})(async (message, match) => {
  const city = String(match || '').trim();
  if (!city) return message.send('❌ ᴘʀᴏᴠɪᴅᴇ ᴄɪᴛʏ ɴᴀᴍᴇ!\n\nᴇxᴀᴍᴘʟᴇ: .weather Siliguri');

  try {
    await message.react?.('🌤️').catch?.(() => {});

    // Open-Meteo needs no API key: geocode the city first, then fetch current weather.
    const geo = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const place = geo?.results?.[0];
    if (!place) return message.send(`❌ ᴄɪᴛʏ ɴᴏᴛ ғᴏᴜɴᴅ: ${city}`);

    const weather = await fetchJSON(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&timezone=auto`
    );

    const code = Number(weather?.current?.weather_code);
    const condition = ({
      0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
      45:'Fog',48:'Depositing rime fog',51:'Light drizzle',53:'Moderate drizzle',55:'Dense drizzle',
      56:'Light freezing drizzle',57:'Dense freezing drizzle',61:'Slight rain',63:'Moderate rain',65:'Heavy rain',
      66:'Light freezing rain',67:'Heavy freezing rain',71:'Slight snow',73:'Moderate snow',75:'Heavy snow',
      77:'Snow grains',80:'Slight rain showers',81:'Moderate rain showers',82:'Violent rain showers',
      85:'Slight snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'
    })[code] || 'Unknown';

    const c = weather.current;
    const country = place.country || place.country_code || '';
    const tz = weather.timezone || place.timezone || '';
    const text =
      `╭━━〔 🌤️ ᴡᴇᴀᴛʜᴇʀ ɪɴғᴏ 〕━━╮\n` +
      `┃ 📍 ʟᴏᴄᴀᴛɪᴏɴ : ${place.name}${country ? `, ${country}` : ''}\n` +
      `┃ 🌡️ ᴛᴇᴍᴘ : ${c.temperature_2m}°C\n` +
      `┃ 🌡️ ғᴇᴇʟs : ${c.apparent_temperature}°C\n` +
      `┃ ☁️ ᴄᴏɴᴅɪᴛɪᴏɴ : ${condition}\n` +
      `┃ 💧 ʜᴜᴍɪᴅɪᴛʏ : ${c.relative_humidity_2m}%\n` +
      `┃ 💨 ᴡɪɴᴅ : ${c.wind_speed_10m} km/h\n` +
      `┃ 🕐 ᴛɪᴍᴇᴢᴏɴᴇ : ${tz}\n` +
      `╰━━━━━━━━━━━━━━━━━━╯`;

    return message.send(text);
  } catch (error) {
    console.error('[weather]', error);
    return message.send('❌ ᴡᴇᴀᴛʜᴇʀ ғᴇᴛᴄʜ ғᴀɪʟᴇᴅ. ᴛʀʏ ᴀɢᴀɪɴ ɪɴ ᴀ ғᴇᴡ sᴇᴄᴏɴᴅs.');
  }
});
