import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface Banner {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  link?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  order: number;
}

export default function BannerCarousel({ shopId }: { shopId: string }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    loadActiveBanners();
  }, [shopId]);

  useEffect(() => {
    if (!autoPlay || banners.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoPlay, banners.length]);

  const loadActiveBanners = async () => {
    try {
      setLoading(true);
      const now = new Date();

      const bannersQuery = query(
        collection(db, 'banners'),
        where('shopId', '==', shopId),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(bannersQuery);
      const bannersData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate?.() || new Date(doc.data().startDate),
          endDate: doc.data().endDate?.toDate?.() || new Date(doc.data().endDate),
        }))
        .filter(banner => banner.startDate <= now && banner.endDate >= now)
        .sort((a, b) => a.order - b.order) as Banner[];

      setBanners(bannersData);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    setAutoPlay(false);
    setCurrentIndex(prev => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = () => {
    setAutoPlay(false);
    setCurrentIndex(prev => (prev + 1) % banners.length);
  };

  const handleDotClick = (index: number) => {
    setAutoPlay(false);
    setCurrentIndex(index);
  };

  const handleBannerClick = (link?: string) => {
    if (link) {
      window.open(link, '_blank');
    }
  };

  if (loading || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative group">
          <div className="relative aspect-video sm:aspect-auto sm:h-64 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={currentBanner.imageUrl}
              alt={currentBanner.title}
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                currentBanner.imageUrl ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

            {currentBanner.link && (
              <button
                onClick={() => handleBannerClick(currentBanner.link)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20 cursor-pointer"
              >
                <div className="flex flex-col items-center gap-2">
                  <ExternalLink className="w-8 h-8 text-white" />
                  <span className="text-white text-sm font-medium">Open Link</span>
                </div>
              </button>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="text-lg sm:text-2xl font-bold mb-1">{currentBanner.title}</h3>
              {currentBanner.description && (
                <p className="text-sm sm:text-base opacity-90 line-clamp-2">{currentBanner.description}</p>
              )}
            </div>

            {banners.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-900" />
                </button>

                <button
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="w-6 h-6 text-gray-900" />
                </button>
              </>
            )}
          </div>

          {banners.length > 1 && (
            <div className="flex justify-center gap-2 mt-3 pb-4">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex ? 'bg-blue-600 w-8' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to banner ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
