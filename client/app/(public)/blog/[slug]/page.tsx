'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { motion } from 'framer-motion';
import type { BlogPost } from '@/types';

export default function BlogDetailPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data } = await api.get(`/blog/${slug}`);
        setPost(data.post);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="animate-pulse space-y-6">
            <div className="h-6 w-32 bg-bg-tertiary rounded" />
            <div className="h-10 w-3/4 bg-bg-tertiary rounded" />
            <div className="h-4 w-48 bg-bg-tertiary rounded" />
            <div className="space-y-3 mt-8">
              {[...Array(8)].map((_, i) => <div key={i} className="h-4 bg-bg-tertiary rounded" style={{ width: `${85 + Math.random() * 15}%` }} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen pt-32 pb-20 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-outfit font-bold mb-4">Post Not Found</h1>
        <p className="text-text-secondary mb-6">The article you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/blog" className="text-accent hover:underline">Back to Blog</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-20">
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto px-4"
      >
        <Link href="/blog" className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>

        {post.cover_image && (
          <div className="aspect-video rounded-2xl overflow-hidden mb-8">
            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <h1 className="text-4xl md:text-5xl font-outfit font-bold mb-6 leading-tight">{post.title}</h1>

        <div className="flex items-center gap-6 text-text-secondary text-sm mb-10 pb-10 border-b border-border">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>{post.author_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(post.published_at || post.created_at)}</span>
          </div>
        </div>

        <div className="prose prose-invert prose-lg max-w-none">
          {post.content.split('\n').map((paragraph, i) => (
            paragraph.trim() ? <p key={i} className="text-text-secondary leading-relaxed mb-6">{paragraph}</p> : null
          ))}
        </div>
      </motion.article>
    </div>
  );
}
