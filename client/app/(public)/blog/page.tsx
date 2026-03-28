'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Calendar, User } from 'lucide-react';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useLanguageStore } from '@/stores/languageStore';
import type { BlogPost } from '@/types';

export default function BlogPage() {
  const { t } = useLanguageStore();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/blog').then(r => setPosts(r.data.posts)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-12">
          <p className="text-accent text-sm tracking-[3px] uppercase font-semibold mb-3">{t.ourBlog}</p>
          <h1 className="font-outfit font-bold text-4xl text-white">{t.latestNewsTips}</h1>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-bg-secondary border border-border rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-[16/10] bg-bg-tertiary" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-bg-tertiary rounded w-3/4" />
                  <div className="h-4 bg-bg-tertiary rounded w-full" />
                  <div className="h-4 bg-bg-tertiary rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-muted text-lg">{t.noBlogPosts}</p>
          </div>
        ) : (
          <motion.div
            initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {posts.map(post => (
              <motion.div
                key={post.id}
                variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              >
                <Link href={`/blog/${post.slug}`} className="group block bg-bg-secondary border border-border rounded-xl overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="relative aspect-[16/10] bg-bg-tertiary overflow-hidden">
                    {post.cover_image && (
                      <Image src={post.cover_image} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-4 text-text-muted text-xs mb-3">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(post.published_at)}</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {post.author_name}</span>
                    </div>
                    <h3 className="font-outfit font-semibold text-white group-hover:text-accent transition-colors mb-2">{post.title}</h3>
                    {post.excerpt && <p className="text-text-secondary text-sm line-clamp-2">{post.excerpt}</p>}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
