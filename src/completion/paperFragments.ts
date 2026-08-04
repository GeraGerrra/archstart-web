export type PaperPattern = "plain" | "grid" | "ruled";
export type PaperShape = "shard" | "ticket" | "sliver";

export interface PaperFragmentDefinition {
  id: string;
  originX: string;
  originY: string;
  travelX: string;
  travelY: string;
  rotation: string;
  width: string;
  height: string;
  pattern: PaperPattern;
  shape: PaperShape;
}

export const LESSON_FRAGMENTS: readonly PaperFragmentDefinition[] = [
  { id: "lesson-01", originX: "45%", originY: "50%", travelX: "-168px", travelY: "-76px", rotation: "-22deg", width: "56px", height: "34px", pattern: "plain", shape: "shard" },
  { id: "lesson-02", originX: "52%", originY: "47%", travelX: "-94px", travelY: "-126px", rotation: "14deg", width: "46px", height: "52px", pattern: "grid", shape: "ticket" },
  { id: "lesson-03", originX: "57%", originY: "52%", travelX: "28px", travelY: "-142px", rotation: "31deg", width: "68px", height: "30px", pattern: "ruled", shape: "sliver" },
  { id: "lesson-04", originX: "59%", originY: "57%", travelX: "142px", travelY: "-74px", rotation: "-9deg", width: "52px", height: "42px", pattern: "plain", shape: "ticket" },
  { id: "lesson-05", originX: "55%", originY: "61%", travelX: "164px", travelY: "38px", rotation: "25deg", width: "62px", height: "32px", pattern: "grid", shape: "shard" },
  { id: "lesson-06", originX: "49%", originY: "62%", travelX: "72px", travelY: "112px", rotation: "-28deg", width: "44px", height: "58px", pattern: "ruled", shape: "ticket" },
  { id: "lesson-07", originX: "44%", originY: "59%", travelX: "-54px", travelY: "118px", rotation: "18deg", width: "72px", height: "28px", pattern: "plain", shape: "sliver" },
  { id: "lesson-08", originX: "42%", originY: "55%", travelX: "-154px", travelY: "54px", rotation: "-35deg", width: "48px", height: "44px", pattern: "grid", shape: "shard" },
];

export const MODULE_FRAGMENTS: readonly PaperFragmentDefinition[] = [
  { id: "module-01", originX: "42%", originY: "48%", travelX: "-228px", travelY: "-94px", rotation: "-28deg", width: "70px", height: "42px", pattern: "plain", shape: "shard" },
  { id: "module-02", originX: "47%", originY: "45%", travelX: "-142px", travelY: "-164px", rotation: "12deg", width: "52px", height: "64px", pattern: "grid", shape: "ticket" },
  { id: "module-03", originX: "52%", originY: "44%", travelX: "-28px", travelY: "-194px", rotation: "36deg", width: "82px", height: "34px", pattern: "ruled", shape: "sliver" },
  { id: "module-04", originX: "58%", originY: "47%", travelX: "112px", travelY: "-172px", rotation: "-16deg", width: "62px", height: "50px", pattern: "plain", shape: "ticket" },
  { id: "module-05", originX: "61%", originY: "51%", travelX: "226px", travelY: "-86px", rotation: "24deg", width: "76px", height: "38px", pattern: "grid", shape: "shard" },
  { id: "module-06", originX: "62%", originY: "56%", travelX: "244px", travelY: "36px", rotation: "-8deg", width: "56px", height: "68px", pattern: "ruled", shape: "ticket" },
  { id: "module-07", originX: "58%", originY: "61%", travelX: "162px", travelY: "136px", rotation: "33deg", width: "88px", height: "32px", pattern: "plain", shape: "sliver" },
  { id: "module-08", originX: "53%", originY: "63%", travelX: "42px", travelY: "184px", rotation: "-31deg", width: "64px", height: "54px", pattern: "grid", shape: "shard" },
  { id: "module-09", originX: "47%", originY: "62%", travelX: "-88px", travelY: "174px", rotation: "17deg", width: "54px", height: "70px", pattern: "ruled", shape: "ticket" },
  { id: "module-10", originX: "42%", originY: "59%", travelX: "-196px", travelY: "116px", rotation: "-38deg", width: "84px", height: "36px", pattern: "plain", shape: "sliver" },
  { id: "module-11", originX: "39%", originY: "54%", travelX: "-244px", travelY: "8px", rotation: "9deg", width: "66px", height: "48px", pattern: "grid", shape: "shard" },
  { id: "module-12", originX: "39%", originY: "50%", travelX: "-214px", travelY: "-64px", rotation: "29deg", width: "48px", height: "62px", pattern: "ruled", shape: "ticket" },
];
