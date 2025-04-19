
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Calendar, User } from 'lucide-react';
import type { BlogPost } from '@/services/blogService';

interface BlogPostCardProps {
  post: BlogPost;
}

export const BlogPostCard: React.FC<BlogPostCardProps> = ({ post }) => {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
          <div className="text-white">
            <h3 className="font-bold text-lg mb-2">{post.title}</h3>
            <div className="flex items-center text-xs space-x-4">
              <div className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {post.date.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
              <div className="flex items-center">
                <User className="h-3 w-3 mr-1" />
                {post.author}
              </div>
            </div>
          </div>
        </div>
      </div>
      <CardContent className="p-6">
        <div className="flex items-center mb-4">
          <span className="bg-primary/10 text-primary text-xs py-1 px-2 rounded-full">
            {post.category}
          </span>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          {post.excerpt}
        </p>
        <Link to={`/blog/${post.slug}`}>
          <Button variant="link" className="px-0">
            Read more <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};
