export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export type LegalDoc = {
  kicker: string;
  title: string;
  updated: string;
  intro: string;
  toc: string;
  sections: LegalSection[];
};
