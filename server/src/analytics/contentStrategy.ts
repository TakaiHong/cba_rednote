import type { ContentStyle, MarketingPost, TargetSegment } from "../types.js";

export interface StrategyBucket {
  key: string;
  posts: number;
  views: number;
  interactions: number;
  inquiries: number;
  interactionRate: number;
  inquiryRate: number;
}

export interface ContentStrategySummary {
  sampleSize: number;
  measuredPosts: number;
  bestStyle?: StrategyBucket;
  bestSegment?: StrategyBucket;
  styleBuckets: StrategyBucket[];
  segmentBuckets: StrategyBucket[];
  recommendation: string;
}

function emptyBucket(key: string): StrategyBucket {
  return {
    key,
    posts: 0,
    views: 0,
    interactions: 0,
    inquiries: 0,
    interactionRate: 0,
    inquiryRate: 0
  };
}

function addPost(bucket: StrategyBucket, post: MarketingPost) {
  const interactions = post.metrics.likes + post.metrics.saves + post.metrics.comments + post.metrics.follows;
  bucket.posts += 1;
  bucket.views += post.metrics.views;
  bucket.interactions += interactions;
  bucket.inquiries += post.metrics.inquiries;
  bucket.interactionRate = bucket.views ? Number(((bucket.interactions / bucket.views) * 100).toFixed(2)) : 0;
  bucket.inquiryRate = bucket.views ? Number(((bucket.inquiries / bucket.views) * 100).toFixed(2)) : 0;
}

function bucketBy<T extends string>(posts: MarketingPost[], getKey: (post: MarketingPost) => T) {
  const buckets = new Map<T, StrategyBucket>();

  for (const post of posts) {
    const key = getKey(post);
    const bucket = buckets.get(key) ?? emptyBucket(key);
    addPost(bucket, post);
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort((a, b) => {
    if (b.inquiries !== a.inquiries) return b.inquiries - a.inquiries;
    if (b.inquiryRate !== a.inquiryRate) return b.inquiryRate - a.inquiryRate;
    return b.interactionRate - a.interactionRate;
  });
}

function chooseRecommendation(measuredPosts: number, bestStyle?: StrategyBucket, bestSegment?: StrategyBucket) {
  if (measuredPosts < 3) {
    return "样本还少，先继续发布 3 到 5 条，并优先补录曝光、收藏和咨询数。";
  }

  if (!bestStyle || !bestSegment || bestStyle.inquiries === 0) {
    return "目前还没有明确咨询转化信号，下一条建议测试故事型或避坑型内容，并强化私信物品清单 CTA。";
  }

  return `下一条优先测试 ${bestSegment.key} 人群的 ${bestStyle.key} 风格，沿用高咨询率角度，并继续记录咨询数。`;
}

export function summarizeContentStrategy(posts: MarketingPost[]): ContentStrategySummary {
  const measuredPosts = posts.filter((post) => post.metrics.views > 0);
  const styleBuckets = bucketBy<ContentStyle>(measuredPosts, (post) => post.topic.style);
  const segmentBuckets = bucketBy<TargetSegment>(measuredPosts, (post) => post.topic.targetSegment);
  const bestStyle = styleBuckets[0];
  const bestSegment = segmentBuckets[0];

  return {
    sampleSize: posts.length,
    measuredPosts: measuredPosts.length,
    bestStyle,
    bestSegment,
    styleBuckets,
    segmentBuckets,
    recommendation: chooseRecommendation(measuredPosts.length, bestStyle, bestSegment)
  };
}
