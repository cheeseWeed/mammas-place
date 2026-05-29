"""
add-landmarks.py

Append 1-3 famous man-made landmarks to each state's `physicalFeatures` array
in data/states.json. Treats landmarks (statues, bridges, monuments, dams,
observatories, towers, halls, etc.) as part of physical features (things you'd
actually go see in a state).

- Uses type "landmark" for all new entries.
- Dedupes by name (case-insensitive) against existing entries.
- Caps each state's total physicalFeatures at 12.
- Preserves every other field exactly.
"""

import json
from pathlib import Path

ROOT = Path(r"C:/Users/dglazier/source/Personal/mammas-place")
DATA_FILE = ROOT / "data" / "states.json"

MAX_FEATURES = 12

# Landmarks to append, keyed by postal code.
# Each entry: name, type="landmark", description (one short sentence,
# kid-appropriate), fact (short, surprising, true).
LANDMARKS = {
    "AL": [
        {"name": "U.S. Space & Rocket Center",
         "description": "A huge museum in Huntsville filled with real NASA rockets, space capsules, and a moon-bound Saturn V.",
         "fact": "Its outdoor Saturn V is one of only three left in the world."},
        {"name": "Vulcan Statue",
         "description": "A giant iron statue of the Roman god of the forge standing on a hill above Birmingham.",
         "fact": "At 56 feet tall, it's the largest cast-iron statue in the world."},
    ],
    "AK": [
        {"name": "Trans-Alaska Pipeline",
         "description": "An 800-mile silver pipeline that carries oil from the Arctic Ocean down to a southern port.",
         "fact": "It zig-zags on purpose so it can flex during earthquakes."},
    ],
    "AZ": [
        {"name": "Hoover Dam",
         "description": "A giant concrete dam on the Colorado River that holds back Lake Mead between Arizona and Nevada.",
         "fact": "It used enough concrete to pave a road from New York to San Francisco."},
        {"name": "London Bridge at Lake Havasu",
         "description": "An old stone bridge from London, England that was taken apart and rebuilt in the Arizona desert.",
         "fact": "Each numbered stone was shipped across the ocean and reassembled in 1971."},
    ],
    "AR": [
        {"name": "Little Rock Central High School",
         "description": "A historic school where nine brave Black students helped end segregation in 1957.",
         "fact": "It's the only working high school in the U.S. that's also a National Historic Site."},
        {"name": "Old State House",
         "description": "A graceful white building in Little Rock that served as Arkansas's first capitol.",
         "fact": "It's one of the oldest surviving state capitol buildings west of the Mississippi."},
    ],
    "CA": [
        {"name": "Golden Gate Bridge",
         "description": "A bright orange suspension bridge stretching across the entrance to San Francisco Bay.",
         "fact": "Its color is officially called 'International Orange' and was chosen to stand out in fog."},
        {"name": "Hollywood Sign",
         "description": "Forty-five-foot-tall white letters spelling HOLLYWOOD on a hillside above Los Angeles.",
         "fact": "It originally said 'HOLLYWOODLAND' as an advertisement for a housing development."},
        {"name": "Golden Gate Bridge Trail Trolleys",
         "description": "San Francisco's famous moving cable cars that climb the city's steepest hills.",
         "fact": "They're the only moving National Historic Landmark in the United States."},
    ],
    "CO": [
        {"name": "United States Air Force Academy Chapel",
         "description": "A row of 17 silver spires that look like jet wings pointing at the sky in Colorado Springs.",
         "fact": "It's the most visited man-made attraction in Colorado."},
        {"name": "Red Rocks Amphitheatre",
         "description": "An outdoor concert stage tucked between two giant red sandstone cliffs.",
         "fact": "The two main rocks are taller than Niagara Falls."},
    ],
    "CT": [
        {"name": "Mark Twain House",
         "description": "The colorful Hartford home where Mark Twain wrote 'The Adventures of Tom Sawyer' and 'Huckleberry Finn'.",
         "fact": "It was one of the first homes in America to have a telephone."},
        {"name": "USS Nautilus Submarine",
         "description": "The world's first nuclear-powered submarine, now a museum visitors can walk through in Groton.",
         "fact": "It was the first sub to ever travel under the North Pole."},
    ],
    "DE": [
        {"name": "Old Swedes Church",
         "description": "A small stone church in Wilmington built in 1698 and still used for worship today.",
         "fact": "It's one of the oldest churches in America still standing on its original foundation."},
        {"name": "Cape Henlopen Lighthouse",
         "description": "A historic guiding light at the spot where Delaware Bay meets the Atlantic Ocean.",
         "fact": "The original 1767 tower fell into the sea — the current one keeps a safer distance."},
    ],
    "FL": [
        {"name": "Kennedy Space Center",
         "description": "NASA's main launch site on Florida's east coast where astronauts blast off to space.",
         "fact": "Every American moon mission launched from this place."},
        {"name": "Walt Disney World",
         "description": "A giant theme park resort near Orlando with castles, rides, and four big parks.",
         "fact": "It's about twice the size of the entire island of Manhattan."},
        {"name": "Castillo de San Marcos",
         "description": "A 350-year-old Spanish stone fort guarding the harbor at St. Augustine.",
         "fact": "Its walls are made of coquina — a soft stone of seashells that absorbs cannonballs instead of shattering."},
    ],
    "GA": [
        {"name": "Stone Mountain",
         "description": "A huge dome of bare granite rising 825 feet above the trees east of Atlanta.",
         "fact": "It's the largest piece of exposed granite in the world."},
        {"name": "Martin Luther King Jr. Birthplace",
         "description": "The Atlanta house where the famous civil rights leader was born in 1929.",
         "fact": "It's part of a National Historical Park you can visit for free."},
    ],
    "HI": [
        {"name": "USS Arizona Memorial",
         "description": "A white memorial floating above the sunken battleship USS Arizona at Pearl Harbor.",
         "fact": "Oil from the ship still slowly leaks to the surface — sailors call them 'black tears'."},
        {"name": "Iolani Palace",
         "description": "The only royal palace on U.S. soil, once home to Hawaii's kings and queens.",
         "fact": "It had electric lights and telephones before the White House did."},
    ],
    "ID": [
        {"name": "Idaho State Capitol",
         "description": "A bright sandstone capitol building in Boise heated entirely by underground hot springs.",
         "fact": "It's the only U.S. state capitol heated by geothermal water."},
        {"name": "Experimental Breeder Reactor I",
         "description": "A small desert lab building where electricity was first ever made from atomic energy.",
         "fact": "On December 20, 1951 it lit four light bulbs — the world's first nuclear power."},
    ],
    "IL": [
        {"name": "Willis Tower",
         "description": "A black 110-story skyscraper in Chicago with glass-floored balconies sticking out of its side.",
         "fact": "It was the tallest building in the world for nearly 25 years."},
        {"name": "Cloud Gate (The Bean)",
         "description": "A giant polished silver sculpture shaped like a bean in downtown Chicago's Millennium Park.",
         "fact": "Its mirror surface has no visible seams — they were polished completely smooth."},
        {"name": "Navy Pier",
         "description": "A long Chicago pier on Lake Michigan with a 200-foot Ferris wheel and amusement rides.",
         "fact": "When it opened in 1916 it was the largest pier in the world."},
    ],
    "IN": [
        {"name": "Indianapolis Motor Speedway",
         "description": "A famous 2.5-mile oval racetrack that hosts the Indianapolis 500 race every May.",
         "fact": "The track is paved with bricks under the finish line — winners kiss the bricks."},
        {"name": "Soldiers' and Sailors' Monument",
         "description": "A tall stone monument in downtown Indianapolis with a goddess of victory on top.",
         "fact": "It's only 15 feet shorter than the Statue of Liberty."},
    ],
    "IA": [
        {"name": "Iowa State Capitol",
         "description": "A grand Des Moines capitol with a real golden dome covered in 23-karat gold leaf.",
         "fact": "It's the only state capitol building in America with five domes."},
        {"name": "Field of Dreams Movie Site",
         "description": "The real Iowa cornfield baseball diamond from the famous movie 'Field of Dreams'.",
         "fact": "The original house and field are still there and visitors can play ball for free."},
    ],
    "KS": [
        {"name": "Eisenhower Presidential Library",
         "description": "A museum in Abilene about Dwight D. Eisenhower, who led the Allies in WWII and became president.",
         "fact": "His boyhood home next door has been preserved exactly as it was in 1898."},
        {"name": "Kansas State Capitol",
         "description": "A Topeka capitol with a copper dome taller than the U.S. Capitol building in Washington.",
         "fact": "Visitors can climb 296 steps to walk out onto the dome itself."},
    ],
    "KY": [
        {"name": "Churchill Downs",
         "description": "The Louisville racetrack with twin spires where the Kentucky Derby horse race is run each May.",
         "fact": "The Derby has been run every single year since 1875 — the longest-running sports event in America."},
        {"name": "Abraham Lincoln Birthplace",
         "description": "A small marble building protecting a log cabin like the one Abraham Lincoln was born in.",
         "fact": "There are 56 steps leading up to it — one for each year of Lincoln's life."},
        {"name": "Louisville Slugger Museum",
         "description": "A baseball bat factory with a 120-foot-tall steel bat leaning against its front wall.",
         "fact": "The giant bat weighs 68,000 pounds — a real one weighs about 2 pounds."},
    ],
    "LA": [
        {"name": "French Quarter",
         "description": "The oldest neighborhood in New Orleans, full of iron balconies, jazz music, and brightly painted buildings.",
         "fact": "Some buildings date back to the 1700s, when Louisiana was ruled by Spain."},
        {"name": "Louisiana State Capitol",
         "description": "The tallest state capitol in America — a 34-story tower in Baton Rouge.",
         "fact": "It was built in just 14 months during the Great Depression."},
    ],
    "ME": [
        {"name": "Portland Head Light",
         "description": "A white lighthouse perched on rocky cliffs at the entrance to Portland Harbor.",
         "fact": "It's the oldest lighthouse in Maine — finished in 1791 on orders from George Washington."},
        {"name": "Bath Iron Works",
         "description": "A historic Maine shipyard that has been building U.S. Navy warships for over 130 years.",
         "fact": "The huge red 'Hammerhead Crane' can be seen from miles down the river."},
    ],
    "MD": [
        {"name": "Fort McHenry",
         "description": "A star-shaped fort in Baltimore Harbor whose huge flag inspired the Star-Spangled Banner.",
         "fact": "Francis Scott Key wrote the poem after seeing the flag still flying at dawn after a battle in 1814."},
        {"name": "U.S. Naval Academy",
         "description": "The college in Annapolis where young men and women train to become U.S. Navy and Marine officers.",
         "fact": "Its grand chapel is sometimes called the 'Cathedral of the Navy'."},
    ],
    "MA": [
        {"name": "Freedom Trail",
         "description": "A red-brick line painted through downtown Boston that connects 16 important Revolutionary War sites.",
         "fact": "It's 2.5 miles long and ends near the spot where the Boston Tea Party happened."},
        {"name": "Plymouth Rock",
         "description": "A simple boulder on the Massachusetts shore said to mark where the Pilgrims first stepped ashore in 1620.",
         "fact": "Today it sits under a stone canopy and is only about half its original size."},
        {"name": "Fenway Park",
         "description": "The oldest baseball stadium in Major League Baseball, home to the Boston Red Sox since 1912.",
         "fact": "Its tall left-field wall is nicknamed the 'Green Monster'."},
    ],
    "MI": [
        {"name": "Mackinac Bridge",
         "description": "A five-mile suspension bridge connecting Michigan's Lower and Upper peninsulas.",
         "fact": "It's so long that one cable contains 42,000 miles of wire."},
        {"name": "Henry Ford Museum",
         "description": "A huge Dearborn museum filled with old cars, planes, trains, and the chair Lincoln was sitting in.",
         "fact": "It even has the actual bus where Rosa Parks refused to give up her seat."},
    ],
    "MN": [
        {"name": "Mall of America",
         "description": "The biggest shopping mall in the United States, with an indoor theme park in the middle.",
         "fact": "It's so big that seven Yankee Stadiums could fit inside it."},
        {"name": "Spoonbridge and Cherry",
         "description": "A giant outdoor sculpture in Minneapolis of a silver spoon balancing a bright red cherry.",
         "fact": "The cherry's stem doubles as a fountain that sprays water in the summer."},
    ],
    "MS": [
        {"name": "Mississippi State Capitol",
         "description": "A bright stone capitol in Jackson topped by a golden eagle with an 8-foot wingspan.",
         "fact": "The eagle is covered in real gold leaf and can be seen for miles."},
        {"name": "Elvis Presley Birthplace",
         "description": "The tiny two-room shotgun house in Tupelo where rock-and-roll legend Elvis Presley was born.",
         "fact": "His family built the entire house themselves for about $180."},
    ],
    "MO": [
        {"name": "Gateway Arch",
         "description": "A shiny stainless-steel arch in St. Louis that stands 630 feet tall on the Mississippi riverfront.",
         "fact": "It's the tallest man-made monument in the United States."},
        {"name": "Harry S. Truman Library",
         "description": "An Independence museum about the president who ended World War II and started NASA's space age.",
         "fact": "Truman went to work there himself almost every day after he left the White House."},
    ],
    "MT": [
        {"name": "Berkeley Pit",
         "description": "A giant old copper mine in Butte that filled with water and turned into a strange green-blue lake.",
         "fact": "Scientists have discovered new kinds of microbes living in its acidic water."},
        {"name": "Going-to-the-Sun Road",
         "description": "A famous mountain road that climbs over the Continental Divide through Glacier country.",
         "fact": "It took 11 years to build and crosses some of the steepest cliffs in America."},
    ],
    "NE": [
        {"name": "Chimney Rock",
         "description": "A tall stone spire that pioneers on the Oregon Trail used as a landmark to find their way west.",
         "fact": "More than 500,000 settlers passed this rock during the 1800s."},
        {"name": "Carhenge",
         "description": "A roadside copy of England's Stonehenge built entirely out of old gray-painted cars near Alliance.",
         "fact": "It uses 39 cars arranged in exactly the same circle as the real Stonehenge."},
    ],
    "NV": [
        {"name": "Hoover Dam",
         "description": "A 726-foot concrete dam on the Colorado River that holds back Lake Mead.",
         "fact": "Its concrete is still slowly hardening — and will keep getting stronger for over 100 years."},
        {"name": "Las Vegas Strip",
         "description": "A four-mile stretch of huge themed hotels and bright neon lights in Las Vegas.",
         "fact": "It's so bright that astronauts say it's the brightest spot on Earth from space."},
    ],
    "NH": [
        {"name": "Mount Washington Cog Railway",
         "description": "The world's first mountain-climbing railway, chugging up to the top of Mount Washington since 1869.",
         "fact": "Some sections of its track are so steep that passengers tilt almost 38 degrees."},
        {"name": "Strawbery Banke Museum",
         "description": "A whole Portsmouth neighborhood of 300-year-old preserved houses that visitors can walk through.",
         "fact": "It has 37 historic buildings still standing on their original spots."},
    ],
    "NJ": [
        {"name": "Lucy the Elephant",
         "description": "A six-story-tall wooden elephant building on the beach in Margate City.",
         "fact": "Built in 1881, she's the oldest roadside attraction still standing in America."},
        {"name": "Cape May Lighthouse",
         "description": "A 157-foot red-and-white lighthouse at the southern tip of New Jersey.",
         "fact": "Visitors can still climb its 199 spiral steps to the top."},
        {"name": "Thomas Edison's Lab",
         "description": "The West Orange laboratory where Thomas Edison invented movies and the recorded music industry.",
         "fact": "More than half of Edison's 1,093 patents came from this single building."},
    ],
    "NM": [
        {"name": "Very Large Array",
         "description": "A field of 27 huge white radio telescopes spread across the Plains of San Agustin.",
         "fact": "Each dish is 82 feet across — together they listen for signals from distant galaxies."},
        {"name": "Loretto Chapel Staircase",
         "description": "A small Santa Fe chapel famous for a spiral staircase that has no center pole holding it up.",
         "fact": "Nobody knows how the mystery carpenter built it — he left without giving his name."},
    ],
    "NY": [
        {"name": "Statue of Liberty",
         "description": "A towering copper statue holding a torch on Liberty Island, a gift from France to celebrate American freedom.",
         "fact": "She's over 305 feet tall and was given to the U.S. in 1886."},
        {"name": "Empire State Building",
         "description": "A 102-story Art Deco skyscraper that towers above midtown Manhattan.",
         "fact": "It was built in just 410 days during the Great Depression."},
        {"name": "Brooklyn Bridge",
         "description": "A stone and steel suspension bridge connecting Manhattan and Brooklyn across the East River.",
         "fact": "When it opened in 1883 it was the longest suspension bridge in the world."},
    ],
    "NC": [
        {"name": "Wright Brothers National Memorial",
         "description": "A tall granite monument at Kitty Hawk marking the spot of the first powered airplane flight.",
         "fact": "The first flight on December 17, 1903 lasted just 12 seconds and went 120 feet."},
        {"name": "Biltmore Estate",
         "description": "America's largest house — a 250-room French chateau-style mansion in Asheville.",
         "fact": "It has its own bowling alley, indoor pool, and a working dairy farm."},
        {"name": "USS North Carolina Battleship",
         "description": "A massive WWII battleship now docked in Wilmington as a floating museum.",
         "fact": "Her nine giant guns could fire shells more than 23 miles."},
    ],
    "ND": [
        {"name": "Enchanted Highway",
         "description": "A 32-mile stretch of country road lined with the world's largest scrap-metal sculptures.",
         "fact": "One sculpture, 'Geese in Flight', is the largest scrap-metal sculpture in the world."},
        {"name": "International Peace Garden",
         "description": "A flower-filled garden right on the border with Canada that celebrates peace between the two nations.",
         "fact": "Visitors can stand with one foot in the U.S. and the other in Canada."},
    ],
    "OH": [
        {"name": "Rock and Roll Hall of Fame",
         "description": "A glass pyramid museum on Cleveland's Lake Erie shore honoring famous rock musicians.",
         "fact": "Its building was designed by the same architect who designed the Louvre's glass pyramid in Paris."},
        {"name": "Pro Football Hall of Fame",
         "description": "A football-shaped museum in Canton dedicated to the greatest NFL players, coaches, and teams.",
         "fact": "Canton was chosen because the NFL was founded there in 1920."},
        {"name": "Cincinnati's Roebling Suspension Bridge",
         "description": "A blue suspension bridge over the Ohio River that was a practice run for the Brooklyn Bridge.",
         "fact": "Built in 1866, it was the world's longest suspension bridge at the time."},
    ],
    "OK": [
        {"name": "Oklahoma City National Memorial",
         "description": "A field of 168 empty chairs honoring those lost in the 1995 Oklahoma City bombing.",
         "fact": "Each chair is engraved with the name of one victim — including 19 small chairs for children."},
        {"name": "Golden Driller",
         "description": "A 76-foot-tall statue of an oil worker holding a real oil derrick in Tulsa.",
         "fact": "He's the tallest free-standing statue in the United States."},
    ],
    "OR": [
        {"name": "Astoria Column",
         "description": "A 125-foot painted tower on a hilltop overlooking the mouth of the Columbia River.",
         "fact": "Visitors can climb 164 spiral steps to the top and toss balsa-wood gliders off."},
        {"name": "Pittock Mansion",
         "description": "A grand stone French chateau on a hill above Portland with sweeping mountain views.",
         "fact": "On clear days you can see five different snow-capped volcanoes from its lawn."},
    ],
    "PA": [
        {"name": "Liberty Bell",
         "description": "A famous cracked bronze bell in Philadelphia that became a symbol of American freedom.",
         "fact": "Nobody knows exactly when the famous crack first appeared."},
        {"name": "Independence Hall",
         "description": "The red-brick Philadelphia building where the Declaration of Independence and Constitution were signed.",
         "fact": "Its clock tower still uses the same bell rung when the Declaration was first read aloud in 1776."},
        {"name": "Fallingwater",
         "description": "A famous house designed by Frank Lloyd Wright that's built right on top of a waterfall.",
         "fact": "Parts of the house actually hang out over the falling water with no posts underneath."},
    ],
    "RI": [
        {"name": "The Breakers Mansion",
         "description": "A 70-room limestone mansion in Newport once owned by the wealthy Vanderbilt family.",
         "fact": "It has 30 rooms just for the servants who took care of it."},
        {"name": "Touro Synagogue",
         "description": "The oldest synagogue building still standing in the United States, in Newport.",
         "fact": "George Washington personally wrote it a letter promising religious freedom in 1790."},
    ],
    "SC": [
        {"name": "Fort Sumter",
         "description": "A small island fort in Charleston Harbor where the first shots of the Civil War were fired in 1861.",
         "fact": "Visitors today can only reach it by boat."},
        {"name": "Angel Oak Tree",
         "description": "A massive live oak tree near Charleston with branches that stretch out 187 feet across.",
         "fact": "It's believed to be about 400-500 years old."},
        {"name": "Arthur Ravenel Jr. Bridge",
         "description": "A graceful diamond-shaped cable bridge soaring across the Cooper River in Charleston.",
         "fact": "Its two towers stand higher than the Washington Monument."},
    ],
    "SD": [
        {"name": "Mount Rushmore",
         "description": "Four giant 60-foot heads of U.S. presidents carved into a granite cliff in the Black Hills.",
         "fact": "It took 14 years and almost 400 workers to carve the faces."},
        {"name": "Crazy Horse Memorial",
         "description": "An enormous mountain carving of Lakota warrior Crazy Horse still being slowly carved out of stone.",
         "fact": "When finished, it will be the largest sculpture in the world — bigger than Mount Rushmore."},
        {"name": "Corn Palace",
         "description": "A building in Mitchell whose outside walls are completely redecorated every year using real corn cobs.",
         "fact": "It takes about 275,000 ears of corn to redecorate it each year."},
    ],
    "TN": [
        {"name": "Graceland",
         "description": "Elvis Presley's Memphis mansion, kept exactly the way it was when he lived there.",
         "fact": "It's the second-most visited house in America — only the White House gets more visitors."},
        {"name": "Parthenon Replica",
         "description": "A full-size copy of the ancient Greek Parthenon temple, built in Nashville's Centennial Park.",
         "fact": "Inside stands a 42-foot golden statue of the goddess Athena."},
        {"name": "Lookout Mountain Incline Railway",
         "description": "A red trolley car that climbs Lookout Mountain on tracks so steep it feels like an elevator.",
         "fact": "Near the top, the grade is 72.7% — one of the steepest passenger railways in the world."},
    ],
    "TX": [
        {"name": "The Alamo",
         "description": "A small Spanish mission in San Antonio where a famous 1836 battle for Texas independence was fought.",
         "fact": "Texans still say 'Remember the Alamo!' nearly 200 years later."},
        {"name": "Texas State Capitol",
         "description": "A massive pink granite capitol in Austin that's taller than the U.S. Capitol in Washington.",
         "fact": "Its pink granite was hauled in by a special railroad built just for the project."},
        {"name": "Space Center Houston",
         "description": "NASA's Houston visitor center where astronauts have trained for every American spaceflight since the 1960s.",
         "fact": "When astronauts say 'Houston, we have a problem,' this is the Houston they're calling."},
    ],
    "UT": [
        {"name": "Salt Lake Temple",
         "description": "A six-spired granite temple in Salt Lake City that took 40 years for pioneers to build.",
         "fact": "Its walls are nine feet thick at the base."},
        {"name": "Golden Spike National Historical Park",
         "description": "The spot where the first railroad to cross the U.S. was completed with a golden spike in 1869.",
         "fact": "Visitors can still see two restored locomotives meet nose-to-nose, just like they did that day."},
        {"name": "This Is the Place Monument",
         "description": "A tall stone monument at the mouth of Emigration Canyon marking the end of the Mormon pioneer trail.",
         "fact": "Brigham Young pointed at this valley in 1847 and said, 'This is the right place.'"},
    ],
    "VT": [
        {"name": "Vermont State House",
         "description": "A small but bright capitol in Montpelier with a golden dome topped by a wooden statue of agriculture.",
         "fact": "Vermont's capital is the smallest of any U.S. state capital — fewer than 8,000 people live there."},
        {"name": "Bennington Battle Monument",
         "description": "A 306-foot stone tower marking a Revolutionary War battle that helped turn the tide against the British.",
         "fact": "It's the tallest structure in the entire state of Vermont."},
    ],
    "VA": [
        {"name": "Mount Vernon",
         "description": "George Washington's white-columned home overlooking the Potomac River.",
         "fact": "Washington designed most of the house himself and is buried on the property."},
        {"name": "Monticello",
         "description": "Thomas Jefferson's mountaintop home outside Charlottesville, designed by Jefferson himself.",
         "fact": "Its image is on the back of the U.S. nickel."},
        {"name": "Colonial Williamsburg",
         "description": "An entire restored 18th-century town where costumed guides live and work like colonial Virginians.",
         "fact": "It's the world's largest living-history museum."},
    ],
    "WA": [
        {"name": "Space Needle",
         "description": "A 605-foot tower in Seattle shaped like a flying saucer balanced on three legs.",
         "fact": "Built for the 1962 World's Fair, it can sway up to one inch per ten mph of wind."},
        {"name": "Grand Coulee Dam",
         "description": "One of the world's biggest concrete dams, holding back the Columbia River in eastern Washington.",
         "fact": "It contains enough concrete to build a sidewalk twice around the Earth."},
        {"name": "Pike Place Market",
         "description": "Seattle's famous waterfront market where vendors toss whole fish through the air to each other.",
         "fact": "It opened in 1907 and is one of the oldest continuously running farmers' markets in America."},
    ],
    "WV": [
        {"name": "New River Gorge Bridge",
         "description": "A long steel arch bridge soaring 876 feet above the New River — once the highest bridge in America.",
         "fact": "Every October, hundreds of people parachute off it on 'Bridge Day'."},
        {"name": "West Virginia State Capitol",
         "description": "A grand limestone capitol in Charleston with a gold-leafed dome reaching 292 feet into the sky.",
         "fact": "Its dome is five feet taller than the U.S. Capitol dome in Washington."},
    ],
    "WI": [
        {"name": "Wisconsin State Capitol",
         "description": "A white granite capitol in Madison topped with a gilded bronze statue called 'Wisconsin'.",
         "fact": "By law, no building in downtown Madison can be taller than its dome."},
        {"name": "House on the Rock",
         "description": "A strange Spring Green attraction full of giant rooms packed with the world's biggest collections of odd things.",
         "fact": "Its 'Infinity Room' juts 218 feet out over the valley with no supports underneath."},
    ],
    "WY": [
        {"name": "Buffalo Bill Center of the West",
         "description": "A massive Cody museum complex of five museums celebrating cowboys, Native Americans, and the Wild West.",
         "fact": "It's been called the 'Smithsonian of the West'."},
        {"name": "Wyoming State Capitol",
         "description": "A sandstone capitol in Cheyenne topped with a 24-karat gold-leaf dome that shines in the sun.",
         "fact": "Bison heads decorate the columns inside — Wyoming's state mammal."},
    ],
    "DC": [
        {"name": "White House",
         "description": "The official home and office of the U.S. President, painted white and surrounded by a fence on Pennsylvania Avenue.",
         "fact": "Every president except George Washington has lived there."},
        {"name": "U.S. Capitol",
         "description": "The white-domed building where Congress meets to make America's laws.",
         "fact": "The bronze 'Statue of Freedom' on top of the dome is almost 20 feet tall."},
        {"name": "Washington Monument",
         "description": "A 555-foot white marble obelisk honoring George Washington — the tallest stone structure in the world.",
         "fact": "Look closely and you can see where construction stopped for 23 years — the stone color slightly changes."},
        {"name": "Lincoln Memorial",
         "description": "A Greek-style temple holding a 19-foot marble statue of Abraham Lincoln looking out over the reflecting pool.",
         "fact": "The Gettysburg Address is carved into one of the walls inside."},
        {"name": "Smithsonian National Air and Space Museum",
         "description": "A huge museum on the National Mall packed with real spacecraft, airplanes, and a moon rock you can touch.",
         "fact": "It holds the actual Wright Brothers' first airplane and Apollo 11's command module."},
    ],
}


def merge_landmarks(state):
    """Append landmarks for this state, dedupe by case-insensitive name,
    and cap total physicalFeatures at MAX_FEATURES."""
    postal = state["postal"]
    additions = LANDMARKS.get(postal, [])
    existing = state.get("physicalFeatures", [])
    existing_names = {f["name"].strip().lower() for f in existing}

    for lm in additions:
        if len(existing) >= MAX_FEATURES:
            break
        if lm["name"].strip().lower() in existing_names:
            continue
        existing.append({
            "name": lm["name"],
            "type": "landmark",
            "description": lm["description"],
            "fact": lm["fact"],
        })
        existing_names.add(lm["name"].strip().lower())

    state["physicalFeatures"] = existing
    return state


def main():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        states = json.load(f)

    print(f"Loaded {len(states)} states")

    total_added = 0
    for state in states:
        before = len(state.get("physicalFeatures", []))
        merge_landmarks(state)
        after = len(state["physicalFeatures"])
        total_added += (after - before)

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(states, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Total landmark entries added: {total_added}")
    print(f"Wrote {DATA_FILE}")


if __name__ == "__main__":
    main()
