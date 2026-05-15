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
  note?: string;
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
  type: 'cover' | 'feedback' | 'assignment-feedback' | 'common-qa' | 'objectives' | 'vocabulary' | 'passage' | 'grammar' | 'exercise' | 'ox-quiz' | 'ox-answer' | 'grammar-quiz' | 'grammar-answer' | 'summary' | 'micro-feedback' | 'custom';
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
