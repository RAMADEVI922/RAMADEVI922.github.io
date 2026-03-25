import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { upsertNotification } from '@/lib/firebaseService';
import { Button } from '@/components/ui/button';
import { Star, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// Simple client-side sentiment analysis
function analyzeSentiment(rating: number, comment: string): 'positive' | 'neutral' | 'negative' {
  const positiveWords = ['great', 'excellent', 'amazing', 'love', 'perfect', 'good', 'nice', 'best', 'fantastic', 'wonderful', 'delicious', 'tasty', 'fresh', 'fast', 'quick', 'friendly', 'helpful', 'clean'];
  const negativeWords = ['bad', 'terrible', 'awful', 'slow', 'cold', 'dirty', 'rude', 'worst', 'horrible', 'disgusting', 'late', 'wrong', 'poor', 'disappointing', 'never', 'not'];

  const lower = comment.toLowerCase();
  const posCount = positiveWords.filter((w) => lower.includes(w)).length;
  const negCount = negativeWords.filter((w) => lower.includes(w)).length;

  if (rating >= 4 && posCount >= negCount) return 'positive';
  if (rating <= 2 || negCount > posCount) return 'negative';
  return 'neutral';
}

const ASPECTS = ['Food Quality', 'Service Speed', 'Staff Behaviour', 'Cleanliness', 'Value for Money'];

export default function FeedbackPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [aspectRatings, setAspectRatings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) { toast.error('Please give a star rating'); return; }
    setSubmitting(true);
    try {
      const sentiment = analyzeSentiment(rating, comment);
      const sentimentEmoji = sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😞' : '😐';
      const msg = [
        `${sentimentEmoji} Feedback — Table ${tableId}`,
        `Rating: ${'⭐'.repeat(rating)} (${rating}/5)`,
        comment ? `Comment: "${comment}"` : '',
        `Sentiment: ${sentiment.toUpperCase()}`,
        Object.entries(aspectRatings).length > 0
          ? 'Aspects: ' + Object.entries(aspectRatings).map(([k, v]) => `${k}: ${v}★`).join(', ')
          : '',
      ].filter(Boolean).join('\n');

      await upsertNotification({
        id: `feedback_${tableId}_${Date.now()}`,
        tableId: tableId!,
        type: 'feedback' as any,
        message: msg,
        read: false,
        createdAt: Date.now(),
        // extra fields stored in message string
      });
      setDone(true);
    } catch (e: any) {
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
          <p className="text-2xl font-bold">Thank You!</p>
          <p className="text-muted-foreground">Your feedback helps us serve you better.</p>
          <Button onClick={() => navigate(`/menu/${tableId}`)} className="w-full mt-4">
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  const displayRating = hovered || rating;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-3">🌟</div>
          <p className="text-2xl font-bold">How was your experience?</p>
          <p className="text-muted-foreground mt-1 text-sm">Table #{tableId} · Takes 30 seconds</p>
        </div>

        {/* Star rating */}
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <p className="text-sm font-semibold text-center text-muted-foreground mb-4 uppercase tracking-wider">Overall Rating</p>
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(s)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`h-10 w-10 transition-colors ${
                    s <= displayRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center mt-3 font-semibold text-sm">
              {rating === 5 ? '🤩 Excellent!' : rating === 4 ? '😊 Good!' : rating === 3 ? '😐 Okay' : rating === 2 ? '😕 Poor' : '😞 Terrible'}
            </p>
          )}
        </div>

        {/* Aspect ratings */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Rate Each Aspect</p>
          {ASPECTS.map((aspect) => (
            <div key={aspect} className="flex items-center justify-between">
              <span className="text-sm font-medium">{aspect}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setAspectRatings((prev) => ({ ...prev, [aspect]: s }))}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-5 w-5 transition-colors ${
                        s <= (aspectRatings[aspect] || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Comment */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tell us more (optional)</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you love? What can we improve?"
            rows={3}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-primary/50 outline-none"
          />
          {comment.length > 0 && (
            <p className={`text-xs mt-1 font-medium ${
              analyzeSentiment(rating, comment) === 'positive' ? 'text-green-600' :
              analyzeSentiment(rating, comment) === 'negative' ? 'text-red-500' : 'text-gray-500'
            }`}>
              Sentiment: {analyzeSentiment(rating, comment)}
            </p>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          size="lg"
        >
          {submitting ? (
            <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />Submitting...</span>
          ) : (
            <span className="flex items-center gap-2"><Send className="h-4 w-4" />Submit Feedback</span>
          )}
        </Button>

        <button onClick={() => navigate(`/menu/${tableId}`)} className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2">
          Skip for now
        </button>
      </div>
    </div>
  );
}
