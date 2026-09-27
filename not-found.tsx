import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="staff-shell min-h-[100dvh] w-full flex items-center justify-center p-6">
      <Card className="w-full max-w-md mx-4 border-[#484039] bg-[#292624] text-[#f5efe4]">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-[#d49a52]" />
            <h1 className="text-2xl font-bold">
              Service screen unavailable
            </h1>
          </div>

          <p className="mt-4 text-sm text-[#a49b8f]">
            This ordering screen could not be found.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
