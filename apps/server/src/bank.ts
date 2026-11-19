import { TIERS, TIER_NAMES, type TriviaQuestion } from '@abyssal/shared';

// Each row is prompt | distinct answers, ordered from easiest to most obscure.
// A tilde introduces an alias. Published row IDs remain stable when appending rows.
const source: Record<string, string> = {
Geography: `
Name a country that borders Germany. | France, Poland, Netherlands~The Netherlands, Austria, Switzerland, Czechia~Czech Republic, Belgium, Denmark, Luxembourg
Name a South American country. | Brazil, Argentina, Colombia, Chile, Peru, Venezuela, Ecuador, Bolivia, Uruguay, Paraguay, Guyana, Suriname
Name a country whose flag contains a crescent. | Turkey~Türkiye, Pakistan, Tunisia, Malaysia, Algeria, Azerbaijan, Singapore, Maldives~The Maldives, Mauritania, Uzbekistan, Turkmenistan, Comoros~The Comoros
Name a national capital on the Danube. | Vienna, Budapest, Belgrade, Bratislava, Vienna Austria~Wien, Budapest Hungary, Belgrade Serbia, Bratislava Slovakia
Name a sovereign country completely south of the equator. | Australia, New Zealand, South Africa, Argentina, Chile, Uruguay, Madagascar, Lesotho, Timor-Leste~East Timor, Eswatini~Swaziland, Namibia, Botswana
Name an island in the Mediterranean Sea. | Sicily~Sicilia, Sardinia~Sardegna, Cyprus, Crete, Mallorca~Majorca, Corsica~Corse, Ibiza, Elba, Menorca~Minorca, Gozo, Hvar, Pantelleria
Name a US state bordering the Pacific Ocean. | California, Alaska, Hawaii~Hawaiʻi, Oregon, Washington~Washington State
Name a river that flows into the Mediterranean or one of its marginal seas. | Nile~Nile River, Rhône~Rhone River, Po~Po River, Ebro~Ebro River, Tiber~Tiber River, Adriatic Neretva~Neretva, Moulouya, Medjerda~Majardah, Aude, Arno
Name an African country on the Indian Ocean or Mozambique Channel. | South Africa, Kenya, Somalia, Tanzania, Mozambique, Madagascar, Comoros, Mauritius, Seychelles
Name a European city with a metro system, excluding national capitals. | Barcelona, Milan~Milano, Hamburg, Munich~München, Naples~Napoli, Porto~Oporto, Bilbao, Lille, Turin~Torino, Lausanne, Brescia, Nuremberg~Nürnberg
Name a country with land inside the Arctic Circle. | Canada, Russia, United States~USA~US, Norway, Sweden, Finland, Denmark~Kingdom of Denmark, Iceland
Name a Canadian province. | Ontario, Quebec~Québec, British Columbia~BC, Alberta, Manitoba, Saskatchewan, Nova Scotia, New Brunswick, Prince Edward Island~PEI, Newfoundland and Labrador
Name an independent island nation in the Pacific Ocean. | Japan, New Zealand, Fiji, Samoa, Tonga, Vanuatu, Nauru, Tuvalu, Kiribati, Palau, Marshall Islands, Solomon Islands, Micronesia~Federated States of Micronesia
Name a US state whose name has two words. | New York, New Jersey, North Carolina, South Carolina, New Mexico, West Virginia, New Hampshire, Rhode Island, North Dakota, South Dakota
`,
Science: `
Name a noble gas. | Helium~He, Neon~Ne, Argon~Ar, Krypton~Kr, Xenon~Xe, Radon~Rn, Oganesson~Og
Name a chemical element named after a person. | Einsteinium~Es, Curium~Cm, Nobelium~No, Mendelevium~Md, Fermium~Fm, Meitnerium~Mt, Seaborgium~Sg, Copernicium~Cn, Roentgenium~Rg, Flerovium~Fl, Rutherfordium~Rf, Bohrium~Bh
Name one of the seven SI base units. | Meter~Metre, Second, Kilogram, Ampere~Amp, Kelvin, Mole, Candela
Name a mammalian blood component. | Red blood cell~Erythrocyte, White blood cell~Leukocyte, Platelet~Thrombocyte, Plasma, Neutrophil, Basophil, Eosinophil, Monocyte, Lymphocyte
Name a type of electromagnetic radiation. | Visible light~Visible, Radio wave~Radio waves, X-ray~X-rays, Ultraviolet~UV, Infrared~IR, Microwave~Microwaves, Gamma ray~Gamma rays
Name a protein-digesting enzyme. | Pepsin, Trypsin, Chymotrypsin, Papain, Bromelain, Elastase, Enteropeptidase~Enterokinase, Carboxypeptidase, Proteinase K
Name a mineral on the Mohs hardness scale. | Diamond, Quartz, Talc, Gypsum, Calcite, Fluorite, Apatite, Orthoclase~Orthoclase feldspar, Topaz, Corundum
Name a cranial nerve by name. | Optic~Optic nerve, Olfactory~Olfactory nerve, Vagus~Vagus nerve, Facial~Facial nerve, Trigeminal~Trigeminal nerve, Trochlear~Trochlear nerve, Oculomotor, Abducens, Glossopharyngeal, Vestibulocochlear, Accessory, Hypoglossal
Name a human bone in the upper limb, including the shoulder girdle. | Humerus, Radius, Ulna, Clavicle~Collarbone, Scapula~Shoulder blade, Scaphoid, Lunate, Pisiform, Trapezium, Capitate, Hamate
Name an amino acid encoded by the standard genetic code. | Glycine, Alanine, Lysine, Leucine, Tryptophan, Valine, Serine, Proline, Cysteine, Arginine, Glutamine, Histidine, Phenylalanine
Name a metal that is ferromagnetic in elemental form near room temperature. | Iron~Fe, Nickel~Ni, Cobalt~Co, Gadolinium~Gd
Name a classically recognized particle of the atom or standard model fermion. | Electron, Proton, Neutron, Up quark~Up, Down quark~Down, Muon, Tau~Tau lepton, Strange quark, Top quark, Charm quark, Bottom quark, Electron neutrino
`,
History: `
Name a Roman emperor of the first century CE. | Augustus, Nero, Caligula~Gaius, Claudius, Tiberius, Vespasian, Titus, Domitian, Galba, Otho, Vitellius, Nerva, Trajan
Name a country that signed the Treaty of Rome in 1957. | France, Italy, West Germany~Federal Republic of Germany~Germany, Belgium, Netherlands~The Netherlands, Luxembourg
Name a US president born in the 19th century. | Abraham Lincoln~Lincoln, Theodore Roosevelt~Teddy Roosevelt~TR, Franklin D Roosevelt~FDR~Franklin Roosevelt, Woodrow Wilson~Wilson, Harry S Truman~Truman, Grover Cleveland~Cleveland, Chester A Arthur~Chester Arthur, James A Garfield~Garfield, Rutherford B Hayes~Hayes, William McKinley~McKinley, Warren G Harding~Warren Harding, Calvin Coolidge~Coolidge, Herbert Hoover~Hoover, Dwight D Eisenhower~Eisenhower~Ike, William Howard Taft~Taft, Benjamin Harrison
Name a British monarch from the House of Hanover. | Queen Victoria~Victoria, George III, George I, George II, George IV, William IV
Name a member of the Central Powers in World War I. | Germany~German Empire, Austria-Hungary~Austro-Hungarian Empire, Ottoman Empire~Ottomans, Bulgaria~Kingdom of Bulgaria
Name an Apollo mission that landed people on the Moon. | Apollo 11~11, Apollo 12~12, Apollo 14~14, Apollo 15~15, Apollo 16~16, Apollo 17~17
Name a state that joined the United States in 1788. | New York, Massachusetts, Virginia, Georgia, Connecticut, Maryland, South Carolina, New Hampshire
Name a modern country that was one of the original United Nations members. | United States~USA, United Kingdom~UK, France, China, Canada, Australia, Egypt, India, Ethiopia, Haiti, Liberia, Nicaragua, Paraguay, Lebanon
Name a ruler from the Tudor dynasty who reigned in England. | Henry VIII~Henry the Eighth, Elizabeth I~Elizabeth the First, Mary I~Bloody Mary, Henry VII, Edward VI
Name a capital of the Mughal Empire. | Delhi~Shahjahanabad, Agra, Lahore, Fatehpur Sikri, Aurangabad
Name a figure carved on Mount Rushmore. | George Washington~Washington, Abraham Lincoln~Lincoln, Thomas Jefferson~Jefferson, Theodore Roosevelt~Teddy Roosevelt
Name a country that formed part of the 1955 Warsaw Pact at its signing. | Soviet Union~USSR, Poland, East Germany~GDR, Hungary, Czechoslovakia, Romania, Bulgaria, Albania
`,
Animals: `
Name an animal that lives in the ocean. | Shark, Dolphin, Whale, Octopus, Jellyfish, Crab, Sea turtle, Lobster, Seahorse, Starfish~Sea star, Seal, Orca~Killer whale, Clownfish, Squid, Sea lion, Manatee, Hermit crab, Oyster, Blue tang~Regal tang, Manta ray, Cuttlefish, Sea cucumber, Sea urchin, Moray eel, Beluga, Nautilus, Giant isopod, Nudibranch, Oarfish, Hagfish, Siphonophore, Coelacanth, Vampire squid, Barreleye
Name a kind of penguin. | Emperor penguin~Emperor, King penguin~King, Adélie penguin~Adelie, Gentoo penguin~Gentoo, Chinstrap penguin~Chinstrap, Macaroni penguin~Macaroni, Snares penguin, Erect-crested penguin, Fiordland penguin, Humboldt penguin, Galápagos penguin
Name a non-penguin flightless bird. | Ostrich, Emu, Kiwi, Cassowary, Rhea, Kakapo~Kākāpō, Takahe~Takahē, Weka, Flightless cormorant, Auckland teal
Name a living feline species. | Lion, Tiger, Domestic cat~Cat, Cheetah, Leopard, Jaguar, Ocelot, Caracal, Serval, Pallas's cat~Manul, Margay, Sand cat, Fishing cat
Name a kind of bear alive today. | Polar bear~Polar, Brown bear~Grizzly~Grizzly bear, American black bear, Giant panda~Panda, Sloth bear, Sun bear, Spectacled bear~Andean bear, Asian black bear~Asiatic black bear
Name a member of the deer family. | Moose~Elk in Europe, Red deer, Reindeer~Caribou, White-tailed deer, Mule deer, Fallow deer, Muntjac, Pudu, Père David's deer, Chital~Axis deer, Sambar
Name an Australian marsupial. | Kangaroo, Koala, Wombat, Wallaby, Tasmanian devil, Quokka, Numbat, Bilby, Quoll, Dunnart, Cuscus, Kultarr
Name a venomous snake. | Cobra, Rattlesnake, Black mamba~Mamba, Viper, Coral snake, Inland taipan~Taipan, Boomslang, Fer-de-lance, Gaboon viper, Tiger snake, Krait, Puff adder
Name a member of the crow family. | Crow, Raven, Magpie, Jay, Jackdaw, Rook, Nutcracker, Chough, Treepie, Stresemann's bushcrow
Name a living genus or common kind of crocodilian. | Alligator, Nile crocodile, Saltwater crocodile~Saltie, Gharial, Caiman, Cuban crocodile, False gharial~Tomistoma, Dwarf crocodile~Osteolaemus, Orinoco crocodile, Mugger crocodile
Name a toothed whale or dolphin. | Bottlenose dolphin, Orca~Killer whale, Sperm whale, Beluga, Narwhal, Pilot whale, Vaquita, Risso's dolphin, Cuvier's beaked whale, Hector's dolphin, Amazon river dolphin~Boto
Name an animal with eight legs as an adult. | Spider, Scorpion, Tick, Mite, Harvestman~Daddy longlegs, Pseudoscorpion, Whip spider~Amblypygid, Vinegaroon~Whip scorpion, Sea spider~Pycnogonid
`,
Movies: `
Name an actor who played James Bond in an official Eon film. | Daniel Craig~Craig, Sean Connery~Connery, Pierce Brosnan~Brosnan, Roger Moore~Moore, Timothy Dalton~Dalton, George Lazenby~Lazenby
Name a feature film directed by Hayao Miyazaki. | Spirited Away, My Neighbor Totoro~My Neighbour Totoro~Totoro, Princess Mononoke, Howl's Moving Castle, Kiki's Delivery Service, Ponyo, The Boy and the Heron, The Wind Rises, Porco Rosso, Castle in the Sky~Laputa, Nausicaä of the Valley of the Wind~Nausicaa, The Castle of Cagliostro
Name a film Steven Spielberg directed that was released in the 1980s. | E.T. the Extra-Terrestrial~ET, Raiders of the Lost Ark~Raiders, Indiana Jones and the Last Crusade~The Last Crusade, Indiana Jones and the Temple of Doom~Temple of Doom, The Color Purple, Empire of the Sun, Always, 1941~Nineteen Forty One
Name a feature film by the Coen brothers. | Fargo, The Big Lebowski~Big Lebowski, No Country for Old Men, True Grit, O Brother Where Art Thou, Raising Arizona, Burn After Reading, Inside Llewyn Davis, Barton Fink, Miller's Crossing, Blood Simple, The Hudsucker Proxy, A Serious Man
Name a film in the main Star Wars Skywalker Saga by its subtitle. | A New Hope~Episode IV, The Empire Strikes Back~Episode V, Return of the Jedi~Episode VI, The Phantom Menace~Episode I, Revenge of the Sith~Episode III, Attack of the Clones~Episode II, The Force Awakens~Episode VII, The Last Jedi~Episode VIII, The Rise of Skywalker~Episode IX
Name a member of the Fellowship in Peter Jackson's first Lord of the Rings film. | Frodo~Frodo Baggins, Gandalf, Aragorn~Strider, Legolas, Samwise~Sam~Samwise Gamgee, Gimli, Boromir, Merry~Meriadoc Brandybuck, Pippin~Peregrin Took
Name a stop-motion animated feature produced by Aardman. | Chicken Run, Wallace & Gromit The Curse of the Were-Rabbit~The Curse of the Were Rabbit, Shaun the Sheep Movie, Early Man, The Pirates in an Adventure with Scientists~The Pirates Band of Misfits, A Shaun the Sheep Movie Farmageddon~Farmageddon, Chicken Run Dawn of the Nugget~Dawn of the Nugget, Wallace & Gromit Vengeance Most Fowl~Vengeance Most Fowl
Name a Pixar feature released from 1995 through 2009. | Toy Story, Finding Nemo, The Incredibles, Monsters Inc, Ratatouille, Cars, WALL-E~Wall E, Up, Toy Story 2, A Bug's Life
Name an actor who played Bruce Wayne in a theatrically released live-action Batman film. | Christian Bale, Michael Keaton, Robert Pattinson, Ben Affleck, George Clooney, Val Kilmer, Adam West
Name a Wes Anderson feature film. | The Grand Budapest Hotel, Fantastic Mr Fox~Fantastic Mister Fox, Moonrise Kingdom, The Royal Tenenbaums, Asteroid City, Isle of Dogs, Rushmore, The Life Aquatic with Steve Zissou~The Life Aquatic, The Darjeeling Limited, Bottle Rocket, The French Dispatch, The Phoenician Scheme
Name a film that won the Best Picture Oscar at a ceremony from 2000 through 2009. | Gladiator, The Lord of the Rings The Return of the King~The Return of the King, The Departed, Slumdog Millionaire, No Country for Old Men, Chicago, A Beautiful Mind, Crash, Million Dollar Baby, American Beauty
Name a Christopher Nolan feature released before 2010. | The Dark Knight, Memento, Batman Begins, The Prestige, Insomnia, Following
`,
Sports: `
Name a country that has won the men's FIFA World Cup. | Brazil, Argentina, Germany~West Germany, France, Italy, Spain, England, Uruguay
Name an original team from the NHL Original Six era. | Toronto Maple Leafs~Maple Leafs, Montreal Canadiens~Canadiens, Boston Bruins~Bruins, New York Rangers~Rangers, Detroit Red Wings~Red Wings, Chicago Blackhawks~Blackhawks~Black Hawks
Name a Grand Slam singles tournament venue in tennis by tournament name. | Wimbledon~The Championships, US Open~U.S. Open, French Open~Roland Garros, Australian Open
Name a men's Summer Olympics host city from 1980 through 2024. | London, Paris, Beijing, Tokyo, Los Angeles~LA, Athens, Sydney, Rio de Janeiro~Rio, Barcelona, Atlanta, Seoul, Moscow
Name a Formula One World Drivers' Champion from 2000 through 2024. | Lewis Hamilton~Hamilton, Michael Schumacher~Schumacher, Max Verstappen~Verstappen, Sebastian Vettel~Vettel, Fernando Alonso~Alonso, Jenson Button~Button, Kimi Räikkönen~Raikkonen, Nico Rosberg~Rosberg
Name a current MLB team from the American League East. | New York Yankees~Yankees, Boston Red Sox~Red Sox, Toronto Blue Jays~Blue Jays, Baltimore Orioles~Orioles, Tampa Bay Rays~Rays
Name an event in the Olympic decathlon. | 100 metres~100m, Long jump, High jump, Shot put, 400 metres~400m, Pole vault, Discus throw~Discus, Javelin throw~Javelin, 110 metre hurdles~110m hurdles, 1500 metres~1500m
Name a national team that has won the men's Rugby Union World Cup through 2023. | New Zealand~All Blacks, South Africa~Springboks, Australia~Wallabies, England
Name a WNBA team active in the 2025 season. | New York Liberty~Liberty, Las Vegas Aces~Aces, Indiana Fever~Fever, Seattle Storm~Storm, Chicago Sky~Sky, Phoenix Mercury~Mercury, Los Angeles Sparks~Sparks, Minnesota Lynx~Lynx, Atlanta Dream~Dream, Connecticut Sun~Sun, Dallas Wings~Wings, Washington Mystics~Mystics, Golden State Valkyries~Valkyries
Name an event in women's artistic gymnastics. | Floor exercise~Floor, Balance beam~Beam, Vault, Uneven bars~Asymmetric bars
Name a winner of the men's Tour de France general classification since 2000, excluding stripped titles. | Tadej Pogačar~Pogacar, Jonas Vingegaard~Vingegaard, Chris Froome~Froome, Alberto Contador~Contador, Egan Bernal~Bernal, Geraint Thomas~Thomas, Bradley Wiggins~Wiggins, Cadel Evans~Evans, Vincenzo Nibali~Nibali, Carlos Sastre~Sastre, Andy Schleck~Schleck, Óscar Pereiro~Pereiro
Name a current NBA team in the Northwest Division. | Denver Nuggets~Nuggets, Oklahoma City Thunder~Thunder~OKC, Minnesota Timberwolves~Timberwolves, Portland Trail Blazers~Trail Blazers~Blazers, Utah Jazz~Jazz
`,
Language: `
Name an English word that ends in the letters -ough. | Through, Though, Tough, Cough, Rough, Enough, Ough, Bough, Dough, Drought-bough~Sough, Pough~Slough
Name a Romance language. | Spanish~Castilian, French, Italian, Portuguese, Romanian, Catalan, Galician, Occitan, Sardinian, Romansh, Ladin, Friulian
Name an English animal word beginning with the letter X. | X-ray tetra~X Ray Tetra, Xerus, Xenops, Xenopus, Xantus's hummingbird~Xantus Hummingbird, Xoloitzcuintli~Xolo, Xantus's murrelet
Name a letter of the Greek alphabet. | Alpha, Beta, Gamma, Delta, Omega, Sigma, Epsilon, Zeta, Theta, Iota, Kappa, Lambda, Mu, Nu, Xi, Omicron, Pi, Rho, Tau, Upsilon, Phi, Chi, Psi, Eta
Name an English word containing three consecutive pairs of repeated letters. | Bookkeeper, Bookkeeping, Bookkeepers, Subbookkeeper, Bookkeep, Bookkept
Name a coordinating conjunction in the English FANBOYS mnemonic. | And, Or, But, So, Yet, Nor, For
Name an English word that commonly begins with a silent K. | Knife, Know, Knee, Knight, Knot, Knack, Knead, Knuckle, Knoll, Knave, Knapsack, Knell
Name an English word that commonly begins with a silent P. | Psychology, Pterodactyl, Pneumonia, Psychic, Psoriasis, Pseudonym, Pteranodon, Ptarmigan, Pneumatic, Psalter, Ptolemaic, Pseudoscience
Name the spelling alphabet codeword for any letter from A through M. | Alpha~Alfa, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliett~Juliet, Kilo, Lima, Mike
Name a widely spoken Slavic language. | Russian, Polish, Ukrainian, Czech, Bulgarian, Slovak, Serbian, Croatian, Belarusian, Bosnian, Slovenian, Macedonian
Name an English noun whose traditional plural ends in -ae. | Formula~Formulae, Larva~Larvae, Alga~Algae, Vertebra~Vertebrae, Antenna~Antennae, Nebula~Nebulae, Amoeba~Amoebae, Pupa~Pupae, Seta~Setae, Lamella~Lamellae
Name an English word ending in the letters -ph. | Graph, Photograph, Paragraph, Alphabet glyph~Glyph, Triumph, Nymph, Seraph, Epitaph, Autograph, Telegraph, Geoglyph, Isomorph, Lymph
`,
Technology: `
Name a programming language created before 1990. | C, C++~Cpp~C Plus Plus, BASIC, Pascal, Lisp, Fortran, COBOL, Ada, Smalltalk, Forth, Erlang, Objective-C, Prolog, Modula-2, Logo, APL
Name a browser used to access the web. | Chrome~Google Chrome, Firefox~Mozilla Firefox, Safari, Edge~Microsoft Edge, Opera, Brave, Vivaldi, Lynx, Netscape Navigator~Netscape, Konqueror, Waterfox, Pale Moon
Name a Unix-like operating system or distribution. | Linux, macOS~Mac OS X, Ubuntu, Debian, Fedora, FreeBSD, OpenBSD, NetBSD, Gentoo, Slackware, illumos, Solaris
Name a common raster image file format. | JPEG~JPG, PNG, GIF, BMP, TIFF~TIF, WebP, AVIF, HEIF~HEIC, TGA, QOI, OpenEXR~EXR, Netpbm~PPM
Name a widely used video container format. | MP4, AVI, MOV~QuickTime, MKV~Matroska, WebM, MPEG-TS~TS, Ogg~OGV, FLV, ASF, MXF
Name a keyboard key with a navigation function. | Up arrow~Up, Down arrow~Down, Left arrow~Left, Right arrow~Right, Home, End, Page Up~PgUp, Page Down~PgDn
Name an HTTP request method. | GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, CONNECT, TRACE
Name a file extension commonly used for compressed archives. | ZIP, RAR, 7z, tar.gz~tgz, tar.bz2~tbz2, tar.xz~txz, Z, LZH, CAB, ACE
Name a relational database management system. | MySQL, PostgreSQL~Postgres, SQLite, Microsoft SQL Server~SQL Server, Oracle Database~Oracle, MariaDB, Firebird, H2, DuckDB, IBM Db2~Db2, CockroachDB
Name a classic web-friendly audio file format. | MP3, WAV~WAVE, AAC, FLAC, Ogg Vorbis~Vorbis, Opus, AIFF, ALAC, AU
Name a family of computer processors or instruction sets. | x86, ARM, RISC-V, MIPS, PowerPC~PPC, SPARC, AVR, 6502~MOS 6502, 68000~68k, Z80, Itanium~IA-64, LoongArch
Name a network application protocol. | HTTP, FTP, SMTP, DNS, SSH, IMAP, POP3, DHCP, NTP, SNMP, LDAP, MQTT, XMPP, NNTP
`,
Food: `
Name an Italian pasta shape. | Spaghetti, Penne, Fusilli, Farfalle~Bow ties, Rigatoni, Orecchiette, Cavatappi, Pappardelle, Trofie, Strozzapreti, Fregola, Mafaldine, Cavatelli, Casarecce
Name an edible mushroom. | Button mushroom~Champignon, Portobello~Portabella, Shiitake, Oyster mushroom, Morel, Chanterelle, Enoki~Enokitake, Lion's mane, Maitake~Hen of the woods, Porcini~Cep, Matsutake, Black trumpet, Wood ear
Name a kind of citrus fruit. | Orange, Lemon, Lime, Grapefruit, Tangerine, Mandarin, Clementine, Kumquat, Pomelo, Yuzu, Calamansi~Calamondin, Sudachi, Finger lime
Name a French cheese. | Brie, Camembert, Roquefort, Comté, Beaufort, Reblochon, Morbier, Époisses, Cantal, Livarot, Pont-l'Évêque, Bleu d'Auvergne, Fourme d'Ambert
Name an ingredient in a masala chai spice blend. | Ginger, Cardamom, Cinnamon, Clove~Cloves, Black pepper~Peppercorn, Star anise, Fennel~Fennel seed, Nutmeg, Allspice
Name an edible dry pulse in the bean or pea family. | Lentil, Chickpea~Garbanzo bean, Kidney bean, Black bean, Split pea, Navy bean, Adzuki~Azuki bean, Mung bean, Pigeon pea, Cowpea~Black-eyed pea, Lupin~Lupini bean, Bambara groundnut
Name a Japanese noodle. | Ramen, Udon, Soba, Sōmen~Somen, Yakisoba, Hiyamugi, Shirataki, Harusame, Kishimen, Hōtō, Soki soba
Name a classic French mother sauce in the modern Escoffier grouping. | Béchamel~Bechamel, Hollandaise, Velouté~Veloute, Espagnole, Sauce tomate~Tomato sauce
Name a cultivar or variety of apple. | Granny Smith, Gala, Fuji, Honeycrisp, Pink Lady~Cripps Pink, Red Delicious, Braeburn, Cortland, Jonathan, Cox's Orange Pippin, Ashmead's Kernel, Gravenstein, Northern Spy, Arkansas Black
Name an edible seed or nut commonly used in a trail mix. | Peanut, Almond, Cashew, Walnut, Pecan, Pistachio, Pumpkin seed~Pepita, Sunflower seed, Brazil nut, Hazelnut~Filbert, Macadamia, Pine nut
Name a dish associated with Korean cuisine. | Kimchi, Bibimbap, Bulgogi, Tteokbokki~Topokki, Japchae, Kimbap~Gimbap, Samgyeopsal, Sundubu-jjigae, Naengmyeon, Doenjang-jjigae, Bossam, Jjimdak
Name an ingredient traditionally found in a standard bánh mì thịt. | Baguette~Bread, Pork~Roast pork, Cucumber, Cilantro~Coriander leaf, Pickled carrot~Carrot, Daikon~Pickled daikon, Pâté~Pate, Mayonnaise~Mayo, Chả lụa~Vietnamese pork sausage, Maggi seasoning~Maggi, Chili~Chilli
`,
Nature: `
Name a genus or common kind of conifer. | Pine~Pinus, Spruce~Picea, Fir~Abies, Cedar~Cedrus, Juniper~Juniperus, Larch~Larix, Hemlock~Tsuga, Redwood~Sequoia, Yew~Taxus, Araucaria, Wollemi pine~Wollemia, Kauri~Agathis
Name a kind of cloud in the ten basic weather cloud genera. | Cumulus, Cumulonimbus, Stratus, Cirrus, Nimbus stratus~Nimbostratus, Stratocumulus, Altocumulus, Altostratus, Cirrostratus, Cirrocumulus
Name a mountain over 8,000 metres above sea level. | Everest~Mount Everest~Chomolungma, K2~Godwin Austen, Annapurna I~Annapurna, Lhotse, Makalu, Manaslu, Dhaulagiri I~Dhaulagiri, Nanga Parbat, Cho Oyu, Kangchenjunga~Kanchenjunga, Gasherbrum I, Gasherbrum II, Broad Peak, Shishapangma
Name a named desert in Asia. | Gobi~Gobi Desert, Arabian Desert, Thar~Thar Desert, Taklamakan~Taklamakan Desert, Karakum~Karakum Desert, Kyzylkum~Kyzylkum Desert, Dasht-e Kavir~Great Salt Desert, Dasht-e Lut~Lut Desert, Ordos Desert, Badain Jaran, Gurbantünggüt
Name a plant known for trapping insects. | Venus flytrap, Pitcher plant, Sundew~Drosera, Bladderwort~Utricularia, Butterwort~Pinguicula, Cobra lily~Darlingtonia, Waterwheel plant~Aldrovanda, Corkscrew plant~Genlisea, Rainbow plant~Byblis, Portuguese sundew~Drosophyllum
Name an active or historically active volcano in Italy. | Vesuvius~Mount Vesuvius, Etna~Mount Etna, Stromboli, Vulcano, Campi Flegrei~Phlegraean Fields, Ischia, Pantelleria, Lipari, Marsili
Name a biome or vegetation zone with notably cold conditions. | Tundra, Taiga~Boreal forest, Alpine tundra, Polar desert~Ice desert, Polar ice cap, Subalpine forest, Arctic desert, Antarctic tundra
Name a species or kind of maple tree. | Sugar maple~Acer saccharum, Red maple~Acer rubrum, Japanese maple~Acer palmatum, Silver maple~Acer saccharinum, Norway maple~Acer platanoides, Field maple~Acer campestre, Bigleaf maple~Acer macrophyllum, Paperbark maple~Acer griseum, Boxelder~Acer negundo, Trident maple~Acer buergerianum
Name a gemstone commonly used as a birthstone. | Diamond, Ruby, Sapphire, Emerald, Amethyst, Opal, Aquamarine, Topaz, Garnet, Peridot, Tanzanite, Alexandrite, Zircon, Spinel, Turquoise
Name a named warm ocean current. | Gulf Stream, Kuroshio~Japan Current, Brazil Current, Agulhas Current, East Australian Current, North Atlantic Drift~North Atlantic Current, Leeuwin Current, Alaska Current, North Brazil Current
Name a named large coral reef system. | Great Barrier Reef, Belize Barrier Reef, New Caledonian Barrier Reef, Mesoamerican Barrier Reef, Florida Reef~Florida Reef Tract, Tubbataha Reefs, Andros Barrier Reef, Ningaloo Reef, Apo Reef, Raja Ampat Reefs
Name a commonly recognized type of wetland. | Swamp, Marsh, Bog, Fen, Mangrove swamp~Mangrove, Salt marsh, Tidal flat~Mudflat, Vernal pool, Floodplain wetland, Peatland
`,
Space: `
Name one of the eight planets in the Solar System. | Earth, Mars, Jupiter, Saturn, Neptune, Venus, Mercury, Uranus
Name a named natural satellite of Jupiter. | Europa, Io, Ganymede, Callisto, Amalthea, Himalia, Thebe, Metis, Adrastea, Elara, Lysithea, Pasiphae, Sinope, Carme
Name a named natural satellite of Saturn. | Titan, Enceladus, Mimas, Rhea, Iapetus, Dione, Tethys, Hyperion, Phoebe, Janus, Epimetheus, Atlas, Helene
Name an internationally recognized zodiac constellation. | Leo, Gemini, Aries, Taurus, Virgo, Cancer, Scorpio~Scorpius, Libra, Sagittarius, Capricorn~Capricornus, Aquarius, Pisces, Ophiuchus
Name a named space telescope. | Hubble~HST, James Webb~JWST~James Webb Space Telescope, Kepler, Spitzer, Chandra, TESS, Herschel, Gaia, Planck, IRAS, Euclid, XMM-Newton
Name a named asteroid or dwarf planet in the asteroid belt. | Ceres, Vesta, Pallas, Hygiea, Juno, Astraea, Hebe, Iris, Flora, Metis, Eunomia, Psyche, Lutetia
Name a NASA Apollo astronaut who walked on the Moon. | Neil Armstrong~Armstrong, Buzz Aldrin~Aldrin, Alan Shepard~Shepard, Pete Conrad~Conrad, Alan Bean~Bean, Edgar Mitchell~Mitchell, David Scott, James Irwin~Jim Irwin, John Young, Charles Duke~Charlie Duke, Eugene Cernan~Gene Cernan, Harrison Schmitt~Schmitt
Name a named moon of Uranus. | Titania, Oberon, Miranda, Ariel, Umbriel, Puck, Portia, Juliet, Desdemona, Rosalind, Belinda, Cupid, Perdita, Caliban
Name a well-known periodic comet. | Halley's Comet~Halley~1P, Encke~2P, Swift-Tuttle~109P, Tempel 1~9P, Churyumov-Gerasimenko~67P, Borrelly~19P, Hartley 2~103P, Wirtanen~46P, Tuttle~8P, Biela~3D
Name a spacecraft that successfully landed on Mars and returned surface data. | Curiosity, Perseverance, Viking 1, Viking 2, Spirit, Opportunity, Phoenix, InSight, Mars Pathfinder~Pathfinder, Sojourner, Zhurong
Name a constellation whose Latin name starts with C. | Cassiopeia, Cygnus, Cancer, Centaurus, Capricornus, Canis Major, Canis Minor, Canes Venatici, Cepheus, Crux, Crater, Corvus, Columba, Corona Borealis, Corona Australis, Camelopardalis
Name a star within 12 light-years of Earth. | Sun~Sol, Alpha Centauri A~Rigil Kentaurus, Proxima Centauri~Proxima, Sirius A~Sirius, Barnard's Star, Wolf 359, Lalande 21185, Ross 154, Ross 248, Epsilon Eridani~Ran, Lacaille 9352
`,
Literature: `
Name a play written by William Shakespeare. | Hamlet, Romeo and Juliet, Macbeth, Othello, King Lear, A Midsummer Night's Dream, Twelfth Night, The Tempest, Cymbeline, Pericles, Coriolanus, Timon of Athens, The Winter's Tale, Measure for Measure
Name a novel by Jane Austen. | Pride and Prejudice, Sense and Sensibility, Emma, Persuasion, Mansfield Park, Northanger Abbey, Lady Susan
Name a Discworld novel by Terry Pratchett. | The Colour of Magic~The Color of Magic, Mort, Guards Guards, Small Gods, Going Postal, Hogfather, Wyrd Sisters, Pyramids, Moving Pictures, Soul Music, Thief of Time, Monstrous Regiment, Unseen Academicals, The Last Continent
Name a novel narrated by or centered on Sherlock Holmes. | The Hound of the Baskervilles~Hound of the Baskervilles, A Study in Scarlet~Study in Scarlet, The Sign of the Four~The Sign of Four, The Valley of Fear~Valley of Fear
Name a work of fiction by Ursula K. Le Guin. | A Wizard of Earthsea, The Left Hand of Darkness, The Dispossessed, The Tombs of Atuan, Tehanu, The Farthest Shore, Always Coming Home, The Lathe of Heaven, The Telling, Malafrena, Lavinia, The Word for World Is Forest
Name a book in the original seven Chronicles of Narnia. | The Lion the Witch and the Wardrobe, Prince Caspian, The Voyage of the Dawn Treader~Voyage of the Dawn Treader, The Magician's Nephew, The Silver Chair, The Horse and His Boy, The Last Battle
Name a novel by Charles Dickens. | Oliver Twist, Great Expectations, David Copperfield, A Tale of Two Cities, Bleak House, Hard Times, Little Dorrit, Our Mutual Friend, Dombey and Son, Nicholas Nickleby, Barnaby Rudge, Martin Chuzzlewit, The Old Curiosity Shop
Name a published novel by Octavia E. Butler. | Kindred, Parable of the Sower, Parable of the Talents, Dawn, Fledgling, Adulthood Rites, Imago, Wild Seed, Mind of My Mind, Clay's Ark, Survivor, Patternmaster
Name a book in the original Oz series by L. Frank Baum. | The Wonderful Wizard of Oz~The Wizard of Oz, The Marvelous Land of Oz, Ozma of Oz, Dorothy and the Wizard in Oz, The Road to Oz, The Emerald City of Oz, The Patchwork Girl of Oz, Tik-Tok of Oz, The Scarecrow of Oz, Rinkitink in Oz, The Lost Princess of Oz, The Tin Woodman of Oz, The Magic of Oz, Glinda of Oz
Name a poem by Edgar Allan Poe. | The Raven, Annabel Lee, The Bells, A Dream Within a Dream, The City in the Sea, The Haunted Palace, Ulalume, Lenore, To Helen, Eldorado, Israfel, Tamerlane
Name a book in the first Earthsea trilogy. | A Wizard of Earthsea, The Tombs of Atuan, The Farthest Shore
Name a novel that won the Booker Prize from 2000 through 2010. | Life of Pi, Wolf Hall, The White Tiger, The Sea, The Inheritance of Loss, Vernon God Little, The Line of Beauty, True History of the Kelly Gang, The Blind Assassin, The Gathering, The Finkler Question
`,
Music: `
Name an instrument in a standard orchestral woodwind section. | Flute, Clarinet, Oboe, Bassoon, Piccolo, English horn~Cor anglais, Bass clarinet, Contrabassoon, E-flat clarinet~Eb clarinet
Name a note in the C major scale, using letter names. | C, D, E, F, G, A, B
Name an official UK studio album by the Beatles. | Abbey Road, Let It Be, Revolver, Rubber Soul, Sgt Pepper's Lonely Hearts Club Band~Sgt Pepper, Help, A Hard Day's Night, The Beatles~White Album, Please Please Me, With the Beatles, Beatles for Sale, Yellow Submarine
Name a basic percussion instrument played with a stick or mallet. | Snare drum~Snare, Xylophone, Timpani~Kettledrums, Triangle, Marimba, Glockenspiel, Vibraphone, Tubular bells, Wood block, Temple block, Crotales, Tam-tam~Gong
Name a composer from the Baroque era. | Johann Sebastian Bach~Bach~J S Bach, Antonio Vivaldi~Vivaldi, George Frideric Handel~Handel, Johann Pachelbel~Pachelbel, Henry Purcell~Purcell, Arcangelo Corelli~Corelli, Claudio Monteverdi~Monteverdi, Domenico Scarlatti~Scarlatti, François Couperin~Couperin, Jean-Philippe Rameau~Rameau, Barbara Strozzi~Strozzi, Élisabeth Jacquet de La Guerre
Name a fretted string instrument. | Guitar, Ukulele~Uke, Banjo, Mandolin, Bass guitar~Electric bass, Sitar, Balalaika, Bouzouki, Lute, Charango, Appalachian dulcimer~Mountain dulcimer, Bağlama~Saz
Name a standard member of the bowed violin family. | Violin, Viola, Cello~Violoncello, Double bass~Contrabass
Name a standard mode of the diatonic major scale. | Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian
Name a musical term that indicates a tempo. | Allegro, Adagio, Andante, Presto, Largo, Moderato, Lento, Vivace, Grave, Prestissimo, Larghetto, Andantino, Allegretto
Name a musical instrument in a standard brass quintet. | Trumpet, Trombone, French horn~Horn, Tuba
Name a country that has won the Eurovision Song Contest at least five times through 2025. | Sweden, Ireland, United Kingdom~UK, France, Netherlands~The Netherlands, Luxembourg
Name an original studio album released by Queen in the 1970s. | A Night at the Opera, News of the World, A Day at the Races, Sheer Heart Attack, Queen, Queen II~Queen 2, Jazz
Name an instrument with piano-style keys. | Piano, Synthesizer~Synth, Pipe organ~Organ, Piano accordion~Accordion, Harpsichord, Digital piano, Keytar, Melodica, Harmonium~Reed organ, Celesta~Celeste, Clavichord, Rhodes piano~Rhodes
`,
};

// Amendments preserve the published row IDs. Equivalent answers share one canonical key.
const amendments: Record<string, string> = {
  'geography-4': 'Name a national capital on the Danube. | Vienna~Wien~Vienna Austria, Budapest~Budapest Hungary, Belgrade~Belgrade Serbia, Bratislava~Bratislava Slovakia',
  'geography-8': 'Name a river that flows into the Mediterranean or one of its marginal seas. | Nile~Nile River, Rhône~Rhone River, Po~Po River, Ebro~Ebro River, Tiber~Tiber River, Neretva, Moulouya, Medjerda~Majardah, Aude, Arno',
  'science-11': 'Name a metal that is ferromagnetic in elemental form at 0°C. | Iron~Fe, Nickel~Ni, Cobalt~Co, Gadolinium~Gd',
  'movies-3': 'Name a film Steven Spielberg directed that was released in the 1980s. | E.T. the Extra-Terrestrial~ET~E.T., Raiders of the Lost Ark~Raiders, Indiana Jones and the Last Crusade~The Last Crusade, Indiana Jones and the Temple of Doom~Temple of Doom, The Color Purple, Empire of the Sun, Always',
  'sports-4': 'Name a Summer Olympics host city from 1980 through 2024. | London, Paris, Beijing, Tokyo, Los Angeles~LA, Athens, Sydney, Rio de Janeiro~Rio, Barcelona, Atlanta, Seoul, Moscow',
  'language-1': 'Name an English word that ends in the letters -ough. | Through, Though, Tough, Cough, Rough, Enough, Bough, Dough, Sough, Slough, Chough, Plough',
  'language-5': 'Name an English word starting with anti-. | Antibody, Antisocial, Antibiotic, Antifreeze, Antivirus, Antiseptic, Anticlimax, Antidote, Antithesis, Anticlockwise, Antimatter, Antipode, Antimacassar, Antidisestablishmentarianism',
  'language-12': 'Name an English word ending in the letters -ph. | Graph, Photograph, Paragraph, Glyph, Triumph, Nymph, Seraph, Epitaph, Autograph, Telegraph, Geoglyph, Isomorph, Lymph',
  'nature-2': 'Name a kind of cloud in the ten basic weather cloud genera. | Cumulus, Cumulonimbus, Stratus, Cirrus, Nimbostratus, Stratocumulus, Altocumulus, Altostratus, Cirrostratus, Cirrocumulus',
};

export const BANK: TriviaQuestion[] = Object.entries(source).flatMap(([category, rows]) =>
  rows.trim().split('\n').map((row, index) => {
    const id = category.toLowerCase() + '-' + (index + 1);
    const [prompt, choices] = (amendments[id] ?? row).split('|').map(part => part.trim());
    const acceptedAnswers = choices.split(',').map((choice, i, all) => {
      const [canonical, ...aliases] = choice.trim().split('~');
      const tier = TIER_NAMES[Math.round(i * (TIER_NAMES.length - 1) / Math.max(1, all.length - 1))];
      return { canonical, aliases, tier, points: TIERS[tier] };
    });
    return { id, prompt, category, acceptedAnswers, difficulty: Math.min(5, Math.max(1, 6 - Math.floor(acceptedAnswers.length / 3))) };
  })
);
