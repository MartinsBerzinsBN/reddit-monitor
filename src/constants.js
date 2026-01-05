const DEFAULT_PORT = 4009;
const DEFAULT_POLL_INTERVAL_SECONDS = 300;
const DEFAULT_RETENTION_DAYS = 60;
const DEFAULT_SUBREDDITS = [
  // General
  "summonerschool",
  "leagueoflegends",
  "LeagueOfDerp",

  // Roles
  "TopMains",
  "Jungle_Mains",
  "MidLaneMains",
  "ADCMains",
  "SupportMains",

  // Mechanics/Replay Heavy Champs
  "YasuoMains",
  "YoneMains",
  "RivenMains",
  "ZedMains",
  "LeeSinMains",
  "KatarinaMains",
  "IreliaMains",
  "AkaliMains",
  "Draven",
  "VayneMains",
  "KaisaMains",
  "JhinMains",
  "EzrealMains",
  "AhriMains",
  "LuxMains",
  "ThreshMains",
];

const DEFAULT_SQLITE_PATH = "./data/reddit-monitor.sqlite";
const DEFAULT_USER_AGENT = "reddit-monitor/1.0 (internal)";

module.exports = {
  DEFAULT_PORT,
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_SUBREDDITS,
  DEFAULT_SQLITE_PATH,
  DEFAULT_USER_AGENT,
};
