export interface MissionDialogue {
  speaker: string;
  text: string;
  sub: string;
  time: number;
}

export interface MissionObjective {
  description: string;
  type: "trigger" | "steal" | "kill" | "collect" | "escape";
  targetX?: number;
  targetY?: number;
  radius?: number;
  count?: number;
  vehicleType?: string;
}

export interface MissionData {
  id: string;
  name: string;
  giver: string;
  reward: number;
  startX: number;
  startY: number;
  objectives: MissionObjective[];
  dialogues: MissionDialogue[];
}

export const CAMPAIGN_MISSIONS: MissionData[] = [
  // CHAPTER 1
  {
    id: "M_01",
    name: "The Daily Grind",
    giver: "Omi Deshmukh",
    reward: 5000,
    startX: 300,
    startY: 1000, // Navapur Old Fort
    dialogues: [
      {
        speaker: "Omi Bhai",
        text: "Kaba, dekh ye log pyaar ki bhasha nahi samajhte. Agar dukandaar paise dene me nautanki kare na, to dukan thodi hila dena!",
        sub: "काबा, देख ये लोग प्यार की भाषा नहीं समझते। अगर दुकानदार पैसे देने में नौटंकी करे ना, तो दुकान थोड़ी हिला देना!",
        time: 5
      },
      {
        speaker: "Jaya",
        text: "Bhai, tension hi mat lo! Hum aisi dukan hilaenge ki uske chillar sidha hamari jeb me girenge. Rickshaw mai chalaunga aaj, ekdum dhoom style!",
        sub: "भाई, टेंशन ही मत लो! हम ऐसी दुकान हिलाएंगे कि उसके चिल्लर सीधा हमारी जेब में गिरेंगे। रिक्शा मैं चलाऊंगा आज, एकदम धूम स्टाइल!",
        time: 5
      },
      {
        speaker: "Kabir",
        text: "Jaya, chup baith aur steering chhod. Tera dhoom style humko sidha lockup me pahunchayega. Omi Bhai, kaam ho jayega.",
        sub: "जया, चुप बैठ और स्टीयरिंग छोड़। तेरा धूम स्टाइल हमको सीधा लॉकअप में पहुंचाएगा। ओमी भाई, काम हो जाएगा।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Auto-Rickshaw mein baitho",
        type: "steal",
        vehicleType: "auto"
      },
      {
        description: "Mandi Bazaar jao aur hafta vasool karo [0/3]",
        type: "collect",
        targetX: 600,
        targetY: 1100,
        radius: 120,
        count: 3
      },
      {
        description: "Hafta Omi Bhai ke safehouse par deliver karo",
        type: "trigger",
        targetX: 460,
        targetY: 1125,
        radius: 40
      }
    ]
  },
  {
    id: "M_02",
    name: "Fueling the Fire",
    giver: "Omi Deshmukh",
    reward: 10000,
    startX: 400,
    startY: 1400, // Shanti Nagar
    dialogues: [
      {
        speaker: "Omi Bhai",
        text: "Hamaare ilake me aake milawati petrol bech rahe hain saale. Jaake unki bhatti thandi kar do!",
        sub: "हमारे इलाके में आके मिलावटी पेट्रोल बेच रहे हैं साले। जाके उनकी भट्टी ठंडी कर दो!",
        time: 4
      },
      {
        speaker: "Jaya",
        text: "Molotov tayyar hai Kabir! Aaj raat inke bhatti me hi diwali manaenge!",
        sub: "मोलोटोव तैयार है कबीर! आज रात इनके भट्टी में ही दिवाली मनाएंगे!",
        time: 4
      }
    ],
    objectives: [
      {
        description: "Rival gang ke fuel depot (Mandi Bazaar) par jao",
        type: "trigger",
        targetX: 650,
        targetY: 1300,
        radius: 50
      },
      {
        description: "Depot guards ko neutralize karo [0/4]",
        type: "kill",
        targetX: 650,
        targetY: 1300,
        radius: 100,
        count: 4
      }
    ]
  },
  {
    id: "M_03",
    name: "Intercept",
    giver: "Jaya Gaikwad",
    reward: 15000,
    startX: 600,
    startY: 1100, // Mandi Bazaar
    dialogues: [
      {
        speaker: "Jaya",
        text: "Kabir! NH-01 par ek bada truck guzar raha hai. Hum ise akele udayenge, apna dhandha shuru karne ke liye!",
        sub: "कबीर! NH-01 पर एक बड़ा ट्रक गुज़र रहा है। हम इसे अकेले उड़ाएंगे, अपना धंधा शुरू करने के लिए!",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Kisanpur bypass road par jao",
        type: "trigger",
        targetX: 1200,
        targetY: 600,
        radius: 60
      },
      {
        description: "Bypass par truck churao",
        type: "steal",
        vehicleType: "truck"
      },
      {
        description: "Highway patrol police se wanted level lose karo",
        type: "escape",
        count: 0
      }
    ]
  },
  {
    id: "M_04",
    name: "The Outpost Raid",
    giver: "Omi Deshmukh",
    reward: 20000,
    startX: 300,
    startY: 1000,
    dialogues: [
      {
        speaker: "Omi Bhai",
        text: "Unke paas hamare illegal transaction ka ledger hai. Wo police ko dene wale hain. Use lekar aao quietly.",
        sub: "उनके पास हमारे इल्लीगल ट्रांजैक्शन का लेजर है। वो पुलिस को देने वाले हैं। उसे लेकर आओ शांति से।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Rival clubhouse (Purana Basti) par jao",
        type: "trigger",
        targetX: 200,
        targetY: 1200,
        radius: 40
      },
      {
        description: "Clubhouse guards ko dher karo [0/3]",
        type: "kill",
        targetX: 200,
        targetY: 1200,
        radius: 80,
        count: 3
      }
    ]
  },
  {
    id: "M_05",
    name: "Blue Lights",
    giver: "Kabir (Self)",
    reward: 25000,
    startX: 420,
    startY: 1150,
    dialogues: [
      {
        speaker: "Inspector Rathore",
        text: "Gadi rok, Kabir! Beech sadak par kanoon se panga mat le. Jaya ko to jail bhej raha hu, tu bhi chalega?",
        sub: "गाड़ी रोक, कबीर! बीच सड़क पर कानून से पंगा मत ले। जया को तो जेल भेज रहा हूँ, तू भी चलेगा?",
        time: 5
      },
      {
        speaker: "Kabir",
        text: "Rathore Sahab! Jaya jaisa bhi hai, mera bhai hai. Aaj ke din to use jail ka khana nahi khane dunga. Jhatka lagne wala hai!",
        sub: "राठौड़ साहब! जया जैसा भी है, मेरा भाई है। आज के दिन तो उसे जेल का खाना नहीं खाने दूंगा। झटका लगने वाला है!",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Police Escort Point (Bypass) par jao",
        type: "trigger",
        targetX: 1400,
        targetY: 800,
        radius: 80
      },
      {
        description: "Cop chase units ko clear karo",
        type: "kill",
        targetX: 1400,
        targetY: 800,
        radius: 200,
        count: 2
      },
      {
        description: "Police se 3-star wanted level lose karo",
        type: "escape",
        count: 3
      }
    ]
  },
  {
    id: "M_06",
    name: "Boundary Lines",
    giver: "Omi Deshmukh",
    reward: 40000,
    startX: 1600,
    startY: 950, // Bridge
    dialogues: [
      {
        speaker: "Kabir",
        text: "Jaya, hathiyar uthao. Aaj inka rasta humesha ke liye band karenge.",
        sub: "जया, हथियार उठाओ। आज इनका रास्ता हमेशा के लिए बंद करेंगे।",
        time: 4
      }
    ],
    objectives: [
      {
        description: "Bridge crossing attackers ko neutralize karo [0/5]",
        type: "kill",
        targetX: 1600,
        targetY: 950,
        radius: 120,
        count: 5
      }
    ]
  },

  // CHAPTER 2
  {
    id: "M_07",
    name: "Capital Transit",
    giver: "Jaya Gaikwad",
    reward: 50000,
    startX: 1360,
    startY: 420,
    dialogues: [
      {
        speaker: "Jaya",
        text: "Kaba, dekh ye sheher! Idhar paisa concrete ki tarah sadak par pada hai. Bus uthane ka dimaag chahiye.",
        sub: "काबा, देख ये शहर! इधर पैसा कंक्रीट की तरह सड़क पर पड़ा है। बस उठाने का दिमाग चाहिए।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Indrapuri Downtown Core par jao",
        type: "trigger",
        targetX: 2300,
        targetY: 1200,
        radius: 60
      }
    ]
  },
  {
    id: "M_08",
    name: "Corporate Interdiction",
    giver: "Shreya Singhania",
    reward: 65000,
    startX: 2300,
    startY: 1200,
    dialogues: [
      {
        speaker: "Jaya",
        text: "Arre Kabir, is municipal babu ka pet dekha hai? Flyover ka cement bhara hai! Jaldi evidence photo lo.",
        sub: "अरे कबीर, इस म्यूनिसिपल बाबू का पेट देखा है? फ्लाईओवर का सीमेंट भरा है! जल्दी एविडेंस फोटो लो।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "University District intersection par jao",
        type: "trigger",
        targetX: 2500,
        targetY: 1500,
        radius: 50
      }
    ]
  },
  {
    id: "M_09",
    name: "The Clean Up",
    giver: "Shreya Singhania",
    reward: 80000,
    startX: 2300,
    startY: 1200,
    dialogues: [
      {
        speaker: "Shreya",
        text: "Kuch local extortionists meri site par kaam nahi karne de rahe. Tameez sikhao unhe.",
        sub: "कुछ लोकल एक्सटॉर्शनिस्ट्स मेरी साइट पर काम नहीं करने दे रहे। तमीज़ सिखाओ उन्हें।",
        time: 4
      }
    ],
    objectives: [
      {
        description: "Indrapuri construction site ke gundon ko clear karo [0/4]",
        type: "kill",
        targetX: 2400,
        targetY: 1350,
        radius: 80,
        count: 4
      }
    ]
  },
  {
    id: "M_10",
    name: "Wiretap",
    giver: "Tracer Salim",
    reward: 95000,
    startX: 2500,
    startY: 1500,
    dialogues: [
      {
        speaker: "Salim",
        text: "Ye tap seedhe Rathore ke direct line ko intercept karega. Par pakde gaye, to mai tumhe nahi jaanta.",
        sub: "ये टैप सीधे राठौड़ के डायरेक्ट लाइन को इंटरसेप्ट करेगा। पर पकड़े गए, तो मैं तुम्हें नहीं जानता।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Central Police HQ ke piche wiretap plant karo",
        type: "trigger",
        targetX: 2300,
        targetY: 1125,
        radius: 35
      }
    ]
  },
  {
    id: "M_11",
    name: "The Raid on Sector 4",
    giver: "Minister Hegde",
    reward: 120000,
    startX: 2800,
    startY: 1100,
    dialogues: [
      {
        speaker: "Kabir",
        text: "Hegde Sahab, mere peeche raho! Jaya, gate block kar, inke paas automatic weapons hain!",
        sub: "हेगड़े साहब, मेरे पीछे रहो! जया, गेट ब्लॉक कर, इनके पास ऑटोमैटिक वेपन्स हैं!",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Sec 4 attackers ko neutralize karo [0/5]",
        type: "kill",
        targetX: 2800,
        targetY: 1100,
        radius: 100,
        count: 5
      }
    ]
  },
  {
    id: "M_12",
    name: "High-Speed Asset",
    giver: "Minister Hegde",
    reward: 150000,
    startX: 2800,
    startY: 1100,
    dialogues: [
      {
        speaker: "Minister Hegde",
        text: "Us file me Swiss accounts aur Shetty ke deal ki copy hai. Agar wo file leak hui to sab khatam!",
        sub: "उस फाइल में स्विस अकाउंट्स और शेट्टी के डील की कॉपी है। अगर वो फाइल लीक हुई तो सब ख़त्म!",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Kisanpur Border Tollway check point par jao",
        type: "trigger",
        targetX: 1360,
        targetY: 420,
        radius: 60
      }
    ]
  },

  // CHAPTER 3
  {
    id: "M_13",
    name: "The Coastal Gateway",
    giver: "Kabir (Self)",
    reward: 180000,
    startX: 3100,
    startY: 1100,
    dialogues: [
      {
        speaker: "Kabir",
        text: "Bandarkhali ke cargo par jo baithega, wo raj karega. Convoy ko docks me park karo.",
        sub: "बंदरखली के कार्गो पर जो बैठेगा, वो राज करेगा। कान्वॉय को डॉक्स में पार्क करो।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Bandarkhali Harbor Docks par jao",
        type: "trigger",
        targetX: 3500,
        targetY: 1200,
        radius: 60
      }
    ]
  },
  {
    id: "M_14",
    name: "Union Pressure",
    giver: "Fatima Shah",
    reward: 210000,
    startX: 3200,
    startY: 1600,
    dialogues: [
      {
        speaker: "Fatima",
        text: "Shetty ke log hamari union ko khatam karna chahte hain taaki wo smuggling kar sakein!",
        sub: "शेट्टी के लोग हमारी यूनियन को ख़त्म करना चाहते हैं ताकि वो स्मगलिंग कर सकें!",
        time: 4
      }
    ],
    objectives: [
      {
        description: "Docks attack breakers ko clear karo [0/4]",
        type: "kill",
        targetX: 3200,
        targetY: 1600,
        radius: 80,
        count: 4
      }
    ]
  },
  {
    id: "M_15",
    name: "Cargo Heist",
    giver: "Jaya Gaikwad",
    reward: 250000,
    startX: 3500,
    startY: 1400,
    dialogues: [
      {
        speaker: "Jaya",
        text: "Shetty ka weapons container swap kar denge to uski kamar toot jayegi! Speedboat tayyar hai.",
        sub: "शेट्टी का वेपन्स कंटेनर स्वाप कर देंगे तो उसकी कमर टूट जाएगी! स्पीडबोट तैयार है।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Docks security yard container swap point par jao",
        type: "trigger",
        targetX: 3600,
        targetY: 1450,
        radius: 40
      }
    ]
  },
  {
    id: "M_16",
    name: "Supply Lines",
    giver: "Tracer Salim",
    reward: 300000,
    startX: 1800,
    startY: 400,
    dialogues: [
      {
        speaker: "Salim",
        text: "Rathore ki task force ne highway par nakebandi laga rakhi hai. Safehouse pahuncho kaise bhi.",
        sub: "राठौड़ की टास्क फ़ोर्स ने हाईवे पर नाकेबंदी लगा रखी है। सेफहाउस पहुँचो कैसे भी।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Bandarkhali cargo warehouse safehouse par deliver karo",
        type: "trigger",
        targetX: 3500,
        targetY: 1200,
        radius: 50
      }
    ]
  },
  {
    id: "M_17",
    name: "Turning the Screws",
    giver: "Shreya Singhania",
    reward: 350000,
    startX: 3600,
    startY: 1100,
    dialogues: [
      {
        speaker: "Shreya",
        text: "Shetty ko sirf paisa samajh aata hai. Uski banking clearing stop kar do server se.",
        sub: "शेट्टी को सिर्फ पैसा समझ आता है। उसकी बैंकिंग क्लियरिंग स्टॉप कर दो सर्वर से।",
        time: 4
      }
    ],
    objectives: [
      {
        description: "Customs Mainframe room par jao",
        type: "trigger",
        targetX: 3540,
        targetY: 625,
        radius: 40
      }
    ]
  },
  {
    id: "M_18",
    name: "Sovereign Control",
    giver: "Kabir (Self)",
    reward: 500000,
    startX: 3300,
    startY: 1500,
    dialogues: [
      {
        speaker: "Kabir",
        text: "Jab tak Shetty aur Hegde khade hain, hum surakshit nahi hain. Control lena hoga.",
        sub: "जब तक शेट्टी और हेगड़े खड़े हैं, हम सुरक्षित नहीं हैं। कण्ट्रोल लेना होगा।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Factory warehouse zone clear karo [0/4]",
        type: "kill",
        targetX: 3300,
        targetY: 1500,
        radius: 120,
        count: 4
      }
    ]
  },

  // CHAPTER 4
  {
    id: "M_19",
    name: "The Set-Up",
    giver: "Minister Hegde",
    reward: 100000,
    startX: 2800,
    startY: 1100,
    dialogues: [
      {
        speaker: "Minister Hegde",
        text: "Tum bohot aage badh gaye, Kabir. Shetty aur mera rishtha tumse bohot purana hai. Alvida.",
        sub: "तुम बोहोत आगे बढ़ गए, कबीर। शेट्टी और मेरा रिश्ता तुमसे बोहोत पुराना है। अलविदा।",
        time: 5
      },
      {
        speaker: "Kabir",
        text: "Jaya! Gadi nikalo! Ye trap hai! Jaya?? Kahan gaya tu?!",
        sub: "जया! गाड़ी निकालो! ये ट्रैप है! जया?? कहाँ गया तू?!",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Shetty ke elite ambushers ko dher karo [0/4]",
        type: "kill",
        targetX: 2800,
        targetY: 1100,
        radius: 80,
        count: 4
      },
      {
        description: "Ambush se 4-star wanted level lose karo",
        type: "escape",
        count: 4
      }
    ]
  },
  {
    id: "M_20",
    name: "Fractured Blood",
    giver: "Kabir (Self)",
    reward: 150000,
    startX: 300,
    startY: 1200,
    dialogues: [
      {
        speaker: "Kaki",
        text: "Kabir beta... gundey aaye the... wo bol rahe the ki tumne kisi Shetty se panga liya hai... aur Jaya unke saath tha...",
        sub: "कबीर बेटा... गुंडे आए थे... वो बोल रहे थे कि तुमने किसी शेट्टी से पंगा लिया है... और जया उनके साथ था...",
        time: 6
      }
    ],
    objectives: [
      {
        description: "Shanti Nagar arson enforcers ko clear karo [0/3]",
        type: "kill",
        targetX: 300,
        targetY: 1200,
        radius: 70,
        count: 3
      }
    ]
  },
  {
    id: "M_21",
    name: "Blind Spot",
    giver: "Tracer Salim",
    reward: 200000,
    startX: 2400,
    startY: 1400,
    dialogues: [
      {
        speaker: "Lieutenant",
        text: "Shetty ne use poore Indrapuri ka control dene ka vaada kiya hai! Jaya thak gaya hoga tera assistant ban kar!",
        sub: "शेट्टी ने उसे पूरे इंद्रपुरी का कण्ट्रोल देने का वादा किया है! जया थक गया होगा तेरा असिस्टेंट बन कर!",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Shetty ke safehouse point (University Core) par jao",
        type: "trigger",
        targetX: 2500,
        targetY: 1500,
        radius: 40
      }
    ]
  },
  {
    id: "M_22",
    name: "Unlikely Accords",
    giver: "Inspector Vikram Rathore",
    reward: 250000,
    startX: 1600,
    startY: 1800,
    dialogues: [
      {
        speaker: "Rathore",
        text: "Mere department ke aadhe log Hegde aur Shetty ki jeb me hain. Mujhe saboot chahiye. Aur tumhe Hegde.",
        sub: "मेरे डिपार्टमेंट के आधे लोग हेगड़े और शेट्टी की जेब में हैं। मुझे सबूत चाहिए। और तुम्हें हेगड़े।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Hegde ke Swiss accounts drive ko safe checkpoint par deliver karo",
        type: "trigger",
        targetX: 9200 / 5,
        targetY: 5100 / 4,
        radius: 40
      }
    ]
  },
  {
    id: "M_23",
    name: "Total Blackout",
    giver: "Fatima Shah",
    reward: 300000,
    startX: 2200,
    startY: 1000,
    dialogues: [
      {
        speaker: "Kabir",
        text: "Theek hai. Aaj raat Indrapuri me andhera hoga. Power grid blast karo.",
        sub: "ठीक है। आज रात इंद्रपुरी में अंधेरा होगा। पावर ग्रिड ब्लास्ट करो।",
        time: 4
      }
    ],
    objectives: [
      {
        description: "Power grid substation core par jao",
        type: "trigger",
        targetX: 2150,
        targetY: 1050,
        radius: 35
      }
    ]
  },
  {
    id: "M_24",
    name: "Cutting the Cord",
    giver: "Kabir (Self)",
    reward: 400000,
    startX: 2700,
    startY: 1300,
    dialogues: [
      {
        speaker: "Shreya",
        text: "Kabir! Mujhe maaf kar do, Hegde aur Shetty ne mujhe dhamkaya tha. Mere paas koi chara nahi tha!",
        sub: "कबीर! मुझे माफ़ कर दो, हेगड़े और शेट्टी ने मुझे धमकाया था। मेरे पास कोई चारा नहीं था!",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Singhania Corporate tower lobby guards ko neutralize karo [0/4]",
        type: "kill",
        targetX: 2700,
        targetY: 1300,
        radius: 80,
        count: 4
      }
    ]
  },

  // CHAPTER 5
  {
    id: "M_25",
    name: "Fall of the Pillar",
    giver: "Kabir (Self)",
    reward: 500000,
    startX: 2900,
    startY: 1200,
    dialogues: [
      {
        speaker: "Kabir",
        text: "Kanoon andha ho sakta hai, Netaji... par ye mitti sab dekhti hai.",
        sub: "कानून अंधा हो सकता है, नेताजी... पर ये मिट्टी सब देखती है।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Hegde ke bodyguard details ko dher karo [0/5]",
        type: "kill",
        targetX: 2900,
        targetY: 1200,
        radius: 100,
        count: 5
      },
      {
        description: "Assault se 5-star wanted level escape karo",
        type: "escape",
        count: 5
      }
    ]
  },
  {
    id: "M_26",
    name: "The Price of Loyalty",
    giver: "Kabir (Self)",
    reward: 750000,
    startX: 3540,
    startY: 620, // Lighthouse
    dialogues: [
      {
        speaker: "Jaya",
        text: "Tu humesha se hi aisa tha, Kabir! Har bada faisla tera! Shetty ne mujhe barabari ka haq diya!",
        sub: "तू हमेशा से ही ऐसा था, कबीर! हर बड़ा फैसला तेरा! शेट्टी ने मुझे बराबरी का हक़ दिया!",
        time: 6
      },
      {
        speaker: "Kabir",
        text: "Jaya, tu pagal ho gaya hai. Shetty ne tere haath me sirf gaddari ki chhuri thamai hai. Tune hamari mitti ko unke lahu se bech diya.",
        sub: "जया, तू पागल हो गया है। शेट्टी ने तेरे हाथ में सिर्फ गद्दारी की छुरी थमाई है। तूने हमारी मिट्टी को उनके लहू से बेच दिया।",
        time: 6
      }
    ],
    objectives: [
      {
        description: "Lighthouse top shooters ko neutralize karo [0/3]",
        type: "kill",
        targetX: 3540,
        targetY: 620,
        radius: 60,
        count: 3
      }
    ]
  },
  {
    id: "M_27",
    name: "Mitti Aur Lahu",
    giver: "Kabir (Self)",
    reward: 2000000,
    startX: 3700,
    startY: 1500, // Cargo Docks Flagship
    dialogues: [
      {
        speaker: "Deven Shetty",
        text: "Mujhe maar ke kya badlega, ladke? Aaj ek Shetty marega, kal dusra meri kursi par baithega...",
        sub: "मुझे मार के क्या बदलेगा, लड़के? आज एक शेट्टी मरेगा, कल दूसरा मेरी कुर्सी पर बैठेगा...",
        time: 5
      },
      {
        speaker: "Kabir",
        text: "Kutte jab paagal ho jate hain na Shetty... to wo malik aur kursi dono ko kaat khaate hain. Agle janam me mitti khareedna, lahu nahi.",
        sub: "कुत्ते जब पागल हो जाते हैं ना शेट्टी... तो वो मालिक और कुर्सी दोनों को काट खाते हैं। अगले जनम में मिट्टी खरीदना, लहू नहीं।",
        time: 5
      }
    ],
    objectives: [
      {
        description: "Cargo vessel elite security details ko dher karo [0/6]",
        type: "kill",
        targetX: 3700,
        targetY: 1500,
        radius: 100,
        count: 6
      },
      {
        description: "Escaping chopper point tak jao",
        type: "trigger",
        targetX: 3540,
        targetY: 625,
        radius: 60
      }
    ]
  }
];
