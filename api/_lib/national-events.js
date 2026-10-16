// Curated, VERIFIED national conventions / TCG championships / major card shows.
// Every row carries the official page its dates came from (source_url) and the
// date it was checked. Rows marked confirmed:false are known events whose
// date or venue is NOT yet published on an official site. They are inserted
// with is_active=false so they never show in the app until someone confirms them.
// Do not add guessed dates here.
//
// Shape: { title, date, end_date, venue, city, state, lat, lng, categories,
//          description, website, source_url, confirmed, is_national }

export const VERIFIED_AT = '2026-10-16'

const SDCC = 'https://www.comic-con.org/cc/plan-your-visit/'
const FANEXPO = 'https://fanexpohq.com/home/events/'
const POKE_REG = 'https://championships.pokemon.com/en-us/events/regionals?region=northamerica'
const YCS = 'https://www.yugioh-card.com/en/events/'
const DCS = 'https://www.dallascardshow.com/2026schedule'
const DENVER_CS = 'https://denvercardshows.com/'
const LORCANA = 'https://www.disneylorcana.com/en-US/play/lorcana-challenge'
const MAGICCON_27 = 'https://magic.wizards.com/en/news/announcements/magiccon-heads-to-japan-europe-and-the-us-in-2027'

const C = ['comics', 'collectibles']
const CARDS = ['cards']
const CARDS_C = ['cards', 'collectibles']

const ev = (o) => ({ confirmed: true, is_national: true, website: o.source_url, ...o })

export const NATIONAL_EVENTS = [
  // --- Comic / pop-culture conventions -------------------------------------
  ev({ title: 'San Diego Comic-Con 2027', date: '2027-07-22', end_date: '2027-07-25', venue: 'San Diego Convention Center', city: 'San Diego', state: 'CA', lat: 32.7066, lng: -117.1619, categories: C, description: 'Comic-Con International. Preview Night Wed July 21, 2027.', website: 'https://www.comic-con.org/', source_url: SDCC }),
  ev({ title: 'New York Comic Con 2027', date: '2027-10-07', end_date: '2027-10-10', venue: 'Javits Center', city: 'New York', state: 'NY', lat: 40.7578, lng: -74.0022, categories: C, description: 'New York Comic Con at the Javits Center.', website: 'https://www.newyorkcomiccon.com/', source_url: 'https://www.newyorkcomiccon.com/en-us/guests/all-guests.html' }),
  ev({ title: 'C2E2 2027', date: '2027-04-30', end_date: '2027-05-02', venue: 'McCormick Place (South Building)', city: 'Chicago', state: 'IL', lat: 41.8513, lng: -87.6155, categories: C, description: 'Chicago Comic & Entertainment Expo.', website: 'https://www.c2e2.com/', source_url: 'https://www.c2e2.com/en-us/about/frequently-asked-questions.html' }),
  ev({ title: 'WonderCon 2027', date: '2027-03-26', end_date: '2027-03-28', venue: 'Anaheim Convention Center', city: 'Anaheim', state: 'CA', lat: 33.8003, lng: -117.9189, categories: C, description: 'Comic-Con International\'s sister show.', website: 'https://www.comic-con.org/wc/', source_url: 'https://www.comic-con.org/wc/' }),
  ev({ title: 'Emerald City Comic Con 2027', date: '2027-03-04', end_date: '2027-03-07', venue: 'Seattle Convention Center (Summit & Arch)', city: 'Seattle', state: 'WA', lat: 47.6114, lng: -122.3320, categories: C, description: 'Seattle\'s pop culture convention.', website: 'https://www.emeraldcitycomiccon.com/', source_url: 'https://www.emeraldcitycomiccon.com/en-us/about/faq-policies.html' }),
  ev({ title: 'FAN EXPO Denver 2027', date: '2027-07-02', end_date: '2027-07-05', venue: 'Colorado Convention Center', city: 'Denver', state: 'CO', lat: 39.7426, lng: -104.9965, categories: C, description: 'Formerly Denver Pop Culture Con. Colorado\'s biggest pop culture convention.', website: 'https://fanexpohq.com/fanexpodenver/', source_url: FANEXPO }),
  ev({ title: 'FAN EXPO New Orleans 2027', date: '2027-01-08', end_date: '2027-01-10', venue: 'Ernest N. Morial Convention Center', city: 'New Orleans', state: 'LA', lat: 29.9425, lng: -90.0646, categories: C, description: 'FAN EXPO New Orleans.', source_url: FANEXPO }),
  ev({ title: 'FAN EXPO Portland 2027', date: '2027-01-29', end_date: '2027-01-31', venue: 'Oregon Convention Center', city: 'Portland', state: 'OR', lat: 45.5287, lng: -122.6630, categories: C, description: 'FAN EXPO Portland.', source_url: FANEXPO }),
  ev({ title: 'FAN EXPO Cleveland 2027', date: '2027-03-12', end_date: '2027-03-14', venue: 'Huntington Convention Center of Cleveland', city: 'Cleveland', state: 'OH', lat: 41.5050, lng: -81.6930, categories: C, description: 'FAN EXPO Cleveland.', source_url: FANEXPO }),
  ev({ title: 'MEGACON Orlando 2027', date: '2027-05-20', end_date: '2027-05-23', venue: 'Orange County Convention Center', city: 'Orlando', state: 'FL', lat: 28.4248, lng: -81.4690, categories: C, description: 'MEGACON Orlando.', source_url: FANEXPO }),
  ev({ title: 'FAN EXPO Philadelphia 2027', date: '2027-05-28', end_date: '2027-05-30', venue: 'Pennsylvania Convention Center', city: 'Philadelphia', state: 'PA', lat: 39.9550, lng: -75.1600, categories: C, description: 'FAN EXPO Philadelphia.', source_url: FANEXPO }),
  ev({ title: 'FAN EXPO Dallas 2027', date: '2027-06-11', end_date: '2027-06-13', venue: 'Kay Bailey Hutchison Convention Center', city: 'Dallas', state: 'TX', lat: 32.7740, lng: -96.8010, categories: C, description: 'FAN EXPO Dallas.', source_url: FANEXPO }),
  ev({ title: 'FAN EXPO Chicago 2027', date: '2027-08-20', end_date: '2027-08-22', venue: 'Donald E. Stephens Convention Center', city: 'Rosemont', state: 'IL', lat: 41.9790, lng: -87.8620, categories: C, description: 'FAN EXPO Chicago.', source_url: FANEXPO }),
  ev({ title: 'FAN EXPO Boston 2027', date: '2027-12-03', end_date: '2027-12-05', venue: 'Thomas M. Menino Convention & Exhibition Center', city: 'Boston', state: 'MA', lat: 42.3450, lng: -71.0460, categories: C, description: 'FAN EXPO Boston.', source_url: FANEXPO }),

  // --- Magic: The Gathering ---------------------------------------------------
  ev({ title: 'MagicCon: Atlanta 2026', date: '2026-11-13', end_date: '2026-11-15', venue: 'Atlanta, GA', city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880, categories: CARDS, description: 'MagicCon: Atlanta.', website: 'https://www.mtgfestivals.com/global/en-us.html', source_url: 'https://www.mtgfestivals.com/global/en-us.html' }),
  ev({ title: 'MagicCon: Detroit 2027', date: '2027-02-26', end_date: '2027-02-28', venue: 'Huntington Place', city: 'Detroit', state: 'MI', lat: 42.3275, lng: -83.0490, categories: CARDS, description: 'First MagicCon of 2027, with Pro Tour Nauctis.', website: 'https://www.mtgfestivals.com/global/en-us.html', source_url: 'https://www.magic.gg/news/magiccon-detroit-2027-dive-into-the-gathering' }),
  ev({ title: 'MagicCon: Las Vegas 2027', date: '2027-08-27', end_date: '2027-08-29', venue: 'Las Vegas, NV (venue TBA)', city: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398, categories: CARDS, description: 'MagicCon: Las Vegas with the third Pro Tour of 2027.', source_url: MAGICCON_27 }),

  // --- Pokémon ----------------------------------------------------------------
  ev({ title: 'Pokémon Regional Championships Las Vegas 2027', date: '2026-12-04', end_date: '2026-12-06', venue: 'Las Vegas, NV', city: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398, categories: CARDS, description: 'Play! Pokémon Regional Championships (2027 season).', source_url: POKE_REG }),
  ev({ title: 'Pokémon Regional Championships Atlanta 2027', date: '2027-01-15', end_date: '2027-01-17', venue: 'Atlanta, GA', city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880, categories: CARDS, description: 'Play! Pokémon Regional Championships.', source_url: POKE_REG }),
  ev({ title: 'Pokémon Regional Championships Milwaukee 2027', date: '2027-04-16', end_date: '2027-04-18', venue: 'Milwaukee, WI', city: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065, categories: CARDS, description: 'Play! Pokémon Regional Championships.', source_url: POKE_REG }),
  ev({ title: 'Pokémon Regional Championships San Diego 2027', date: '2027-05-28', end_date: '2027-05-30', venue: 'San Diego, CA', city: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611, categories: CARDS, description: 'Play! Pokémon Regional Championships.', source_url: POKE_REG }),
  ev({ title: 'Pokémon North America International Championships 2027', date: '2027-06-18', end_date: '2027-06-20', venue: 'Chicago, IL', city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, categories: CARDS, description: 'NAIC 2027 (TCG, VGC, GO).', website: 'https://championships.pokemon.com/en-us/events/internationals/2027/chicago', source_url: 'https://championships.pokemon.com/en-us/events/internationals/2027/chicago' }),
  ev({ title: 'Pokémon Regional Championships Seattle 2027', date: '2027-02-06', end_date: '2027-02-07', venue: 'Seattle, WA', city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, categories: CARDS, description: 'UNCONFIRMED: listed by community calendars, not yet on the official regionals page.', source_url: POKE_REG, confirmed: false }),
  ev({ title: 'Pokémon Regional Championships San Antonio 2027', date: '2027-02-27', end_date: '2027-02-28', venue: 'San Antonio, TX', city: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936, categories: CARDS, description: 'UNCONFIRMED: listed by community calendars, not yet on the official regionals page.', source_url: POKE_REG, confirmed: false }),

  // --- Yu-Gi-Oh! / One Piece / Lorcana ---------------------------------------
  ev({ title: 'Yu-Gi-Oh! Championship Series Houston 2026', date: '2026-10-16', end_date: '2026-10-18', venue: 'Houston, TX', city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, categories: CARDS, description: 'YCS Houston.', source_url: YCS }),
  ev({ title: 'Yu-Gi-Oh! Championship Series Orlando 2026', date: '2026-11-06', end_date: '2026-11-08', venue: 'Orlando, FL', city: 'Orlando', state: 'FL', lat: 28.5384, lng: -81.3789, categories: CARDS, description: 'YCS Orlando.', source_url: YCS }),
  ev({ title: 'ONE PIECE Card Game Championship 26-27 Finals Season 2 (North America)', date: '2027-01-09', end_date: '2027-01-10', venue: 'Orange County Convention Center', city: 'Orlando', state: 'FL', lat: 28.4248, lng: -81.4690, categories: CARDS, description: 'Invite-only NA Finals with a Last Chance Qualifier, run by Play!TCG.', source_url: 'https://en.onepiece-cardgame.com/events/26-27_Finals_Season_2.html' }),
  ...['2026-12-18', '2027-02-19', '2027-04-09', '2027-06-18'].map((d) => ev({
    title: `Disney Lorcana Challenge North America (${d.slice(0, 7)})`, date: d, end_date: null, venue: 'TBA', city: 'TBA', state: '', lat: null, lng: null, categories: CARDS,
    description: 'UNCONFIRMED LOCATION: dates are on the official Lorcana Challenge page but the host city is not listed yet.', source_url: LORCANA, confirmed: false,
  })),

  // --- Sports cards / big card shows -----------------------------------------
  ev({ title: 'National Sports Collectors Convention 2027', date: '2027-07-28', end_date: '2027-08-01', venue: 'Donald E. Stephens Convention Center', city: 'Rosemont', state: 'IL', lat: 41.9790, lng: -87.8620, categories: CARDS_C, description: 'The 47th National ("The National").', website: 'https://www.nsccshow.com/', source_url: 'https://www.nsccshow.com/future-events' }),
  ev({ title: 'TRISTAR Houston Show 2027', date: '2027-02-05', end_date: '2027-02-07', venue: 'Houston, TX', city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, categories: CARDS_C, description: '41st Annual TRISTAR Houston Collectors Show.', source_url: 'https://www.tristarproductions.com/schedule.html' }),
  ev({ title: 'Collect-A-Con Dallas 2026', date: '2026-10-24', end_date: '2026-10-25', venue: 'Kay Bailey Hutchison Convention Center Hall B', city: 'Dallas', state: 'TX', lat: 32.7740, lng: -96.8010, categories: ['cards', 'collectibles', 'toys'], description: 'Trading card, anime & pop culture convention. Sat 10-6, Sun 10-5.', source_url: 'https://collectaconusa.com/dallas/' }),
  ev({ title: 'Collect-A-Con Houston 2 2026', date: '2026-11-07', end_date: '2026-11-08', venue: 'George R. Brown Convention Center Hall B', city: 'Houston', state: 'TX', lat: 29.7522, lng: -95.3586, categories: ['cards', 'collectibles', 'toys'], description: 'Trading card, anime & pop culture convention. Sat 10-6, Sun 10-5.', source_url: 'https://collectaconusa.com/houston2/' }),
  ev({ title: 'DCS New Jersey', date: '2026-10-30', end_date: '2026-11-01', venue: 'NJ Convention & Expo Center', city: 'Edison', state: 'NJ', lat: 40.5187, lng: -74.3326, categories: CARDS, description: 'Dallas Card Show series stop.', source_url: DCS }),
  ev({ title: 'DCS Chicago', date: '2026-11-13', end_date: '2026-11-15', venue: 'Schaumburg Convention Center', city: 'Schaumburg', state: 'IL', lat: 42.0447, lng: -88.0384, categories: CARDS, description: 'Dallas Card Show series stop.', source_url: DCS }),
  ev({ title: 'DCS Houston', date: '2026-12-18', end_date: '2026-12-20', venue: 'George R. Brown Convention Center', city: 'Houston', state: 'TX', lat: 29.7522, lng: -95.3586, categories: CARDS, description: 'Dallas Card Show series stop.', source_url: DCS }),
  ...[['2026-11-05', '2026-11-08'], ['2027-01-14', '2027-01-17'], ['2027-03-18', '2027-03-21'], ['2027-05-20', '2027-05-23'], ['2027-07-08', '2027-07-11'], ['2027-09-08', '2027-09-12'], ['2027-11-11', '2027-11-14']].map(([d, e]) => ev({
    title: 'Dallas Card Show', date: d, end_date: e, venue: 'Marriott Watters Creek Convention Center', city: 'Allen', state: 'TX', lat: 33.1100, lng: -96.6740, categories: CARDS,
    description: 'The largest card show series in the nation.', website: 'https://www.dallascardshow.com/', source_url: DCS,
  })),

  // --- Colorado regional shows (flagged local, but curated here) -------------
  ...[['2026-10-23', '2026-10-25'], ['2026-12-11', '2026-12-13'], ['2027-02-18', '2027-02-21'], ['2027-04-08', '2027-04-11'], ['2027-06-24', '2027-06-27'], ['2027-08-26', '2027-08-29'], ['2027-10-21', '2027-10-24'], ['2027-12-09', '2027-12-12']].map(([d, e]) => ev({
    title: 'Denver Card Shows', date: d, end_date: e, venue: 'Livestock Center, 4850 National Western Dr', city: 'Denver', state: 'CO', lat: 39.7820, lng: -104.9710, categories: ['cards', 'collectibles'],
    description: 'Colorado\'s largest collectibles show: sports cards, Pokémon, Yu-Gi-Oh, MTG, comics, toys. TCG tournaments Sat & Sun. Free GA. Organizer notes dates may change.', website: DENVER_CS, source_url: DENVER_CS, is_national: false,
  })),
  ev({ title: 'Colorado Collectors Forum Card Show (Holiday Showcase)', date: '2026-11-21', end_date: null, venue: 'Marriott Denver South, 10345 Park Meadows Dr', city: 'Lone Tree', state: 'CO', lat: 39.5440, lng: -104.8740, categories: CARDS, description: 'UNCONFIRMED: only listed on third-party card-show directories (cardshows.io, tcdb); no official organizer page found.', source_url: 'https://cardshows.io/events/colorado-collectors-forum-card-show-11-21-2026', confirmed: false, is_national: false }),

  // --- Lorcana Challenge Championship Qualifiers (store-hosted, official list) -
  ...[
    ['2026-10-24', '2026-10-25', 'Lorcana CCQ — Through the Decades Collectables', 'Louisville', 'KY', 38.2527, -85.7585],
    ['2026-11-07', '2026-11-08', 'Lorcana CCQ — Game on Chattanooga (Chattanooga ComicCon)', 'Chattanooga', 'TN', 35.0456, -85.3097],
    ['2026-11-21', null, 'Lorcana CCQ — Once Upon a CCQ, Last Stand Collectables', 'Yakima', 'WA', 46.6021, -120.5059],
    ['2026-11-28', '2026-11-29', 'Lorcana CCQ — Tri-County Collectables', 'Fenton', 'MI', 42.7978, -83.7049],
    ['2026-12-12', null, 'Lorcana CCQ — Collectors Store', 'Saint Peters', 'MO', 38.8003, -90.6265],
  ].map(([d, e, t, city, st, lat, lng]) => ev({
    title: t, date: d, end_date: e, venue: city + ', ' + st, city, state: st, lat, lng, categories: CARDS,
    description: 'Disney Lorcana Challenge Championship Qualifier (store-hosted).', source_url: LORCANA, is_national: false,
  })),
]
