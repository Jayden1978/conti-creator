'use client';

interface StepProgressProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { number: 1, label: '분석' },
  { number: 2, label: '슬라이드' },
  { number: 3, label: '내보내기' },
];

export default function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="flex items-center justify-center gap-0 py-6">
      {steps.map((step, index) => {
        const isCompleted = step.number < currentStep;
        const isCurrent = step.number === currentStep;
        const isPending = step.number > currentStep;

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                style={{
                  background: isCompleted ? '#22c55e' : isCurrent ? '#F97316' : '#333',
                  color: isPending ? '#888' : '#fff',
                  border: isCurrent ? '2px solid #F97316' : 'none',
                }}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: isPending ? '#666' : isCurrent ? '#F97316' : '#22c55e' }}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className="w-24 h-0.5 mb-5 mx-1"
                style={{ background: isCompleted ? '#22c55e' : '#333' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
