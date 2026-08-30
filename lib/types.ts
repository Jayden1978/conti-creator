export interface ChainQuestionItem {
  number: number;
  label: string;
  tag: string;
  steps: string[];
  correct: boolean;
  fix?: string;
}

export interface SlideData {
  title?: string;
  subtitle?: string;
  content?: string;
  items?: string[];
  columns?: { title: string; content: string }[];
  vocabulary?: { word: string; meaning: string; example?: string }[];
  passage?: { text: string; source?: string; questionNumber?: number; questionType?: string; underlinedText?: string };
  choices?: string[];
  questions?: { number: number; question: string; options?: string[]; answer?: string }[];
  oxQuestions?: { number: number; statement: string; answer: 'O' | 'X'; explanation?: string }[];
  grammarQuestions?: { number: number; sentence: string; optionA: string; optionB: string; answer: 'A' | 'B'; grammarType?: string; explanation?: string }[];
  chainQuestions?: ChainQuestionItem[];
  lineEnglishSentences?: { number: number; text: string }[];
  lineEnglishPair?: {
    prevNumber: number;
    prevText: string;
    nextNumber: number;
    nextText: string;
    index: number;
    total: number;
  };
  note?: string;
  mainQuestion?: string;
  subQuestions?: string[];
  answers?: string[];
  className?: string;
  classDay?: string;
  meta?: string;
  bgColor?: string;
  subtitleColor?: string;
  subtitleSize?: number;
  titleColor?: string;
  titleSize?: number;
}

export interface SlideItem {
  id: string;
  projectId: string;
  order: number;
  type: 'cover' | 'feedback' | 'assignment-feedback' | 'common-qa' | 'objectives' | 'vocabulary' | 'passage' | 'grammar' | 'exercise' | 'ox-quiz' | 'ox-answer' | 'grammar-quiz' | 'grammar-answer' | 'grammar-chain' | 'summary' | 'micro-feedback' | 'reading-activity' | 'reading-answer' | 'line-english' | 'line-english-tail' | 'custom';
  layout: 'title-only' | 'title-content' | 'two-column' | 'list' | 'card-grid' | 'passage' | 'exercise';
  data: SlideData;
  approved: boolean;
}

export interface ProjectItem {
  id: string;
  name: string;
  subject: string;
  grade: string;
  topic: string;
  status: 'analyze' | 'slides' | 'export';
  slideCount: number;
  createdAt: string;
}

export interface MinutesItemData {
  title?: string;
  content?: string;
  task?: string;
  owner?: string;
  dueDate?: string;
  items?: string[];
}

export interface MinutesItem {
  id: string;
  meetingId: string;
  order: number;
  type: 'agenda' | 'discussion' | 'decision' | 'action-item' | 'note';
  data: MinutesItemData;
  done: boolean;
}

export interface MeetingItem {
  id: string;
  name: string;
  department: string;
  meetingType: string;
  topic: string;
  date: string;
  attendees: string;
  status: 'record' | 'items' | 'export';
  itemCount: number;
  createdAt: string;
}
