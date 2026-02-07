'use client';

import { useCallback, useRef } from 'react';
import { useFloorPlanStore } from '@/store/floor-plan-store';
import { useAnalyzeFloorPlan } from '@/hooks/useAnalyzeFloorPlan';
import { Button } from '@/components/ui/button';

export function FloorPlanUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    uploadedImage,
    setUploadedImage,
    isAnalyzing,
    analysisError,
    analysisProgress,
    floorPlan,
    clearFloorPlan,
    setFloorPlan,
    setShowImageOverlay,
  } = useFloorPlanStore();
  const { analyze } = useAnalyzeFloorPlan();

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        useFloorPlanStore
          .getState()
          .setAnalysisError('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setUploadedImage(dataUrl);
        useFloorPlanStore.getState().setAnalysisError(null);

        // Auto-create empty floor plan sized to image aspect ratio and show overlay
        const img = new window.Image();
        img.onload = () => {
          const store = useFloorPlanStore.getState();
          if (!store.floorPlan) {
            const baseWidth = 20; // meters
            const aspect = img.naturalHeight / img.naturalWidth;
            const height = baseWidth * aspect;
            setFloorPlan({
              rooms: [],
              walls: [],
              units: 'meters',
              scale: 1,
              overallWidth: Math.round(baseWidth * 100) / 100,
              overallHeight: Math.round(height * 100) / 100,
            });
          }
          setShowImageOverlay(true);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [setUploadedImage, setFloorPlan, setShowImageOverlay],
  );

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-sm font-semibold">Floor Plan</h3>

      {uploadedImage ? (
        <div className="space-y-2">
          <img
            src={uploadedImage}
            alt="Floor plan preview"
            className="w-full rounded-md border border-border object-contain max-h-32"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 text-xs"
              onClick={analyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {analysisProgress || 'Analyzing...'}
                </span>
              ) : floorPlan ? (
                'Re-analyze'
              ) : (
                'Analyze Floor Plan'
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                clearFloorPlan();
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-muted-foreground text-xs space-y-1">
            <p className="font-medium">Upload floor plan image</p>
            <p>PNG, JPG, WebP, or SVG</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {analysisError && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
          {analysisError}
        </div>
      )}
    </div>
  );
}
