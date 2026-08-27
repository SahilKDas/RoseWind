import { describe, expect, it } from 'vitest';
import { compile } from '../language/compiler';
import { beginnerLessons } from './beginner-lessons';
import { examples } from './examples';

describe('beginner learning path', () => {
  it('starts with a two-line program that needs no prior concepts', () => {
    expect(examples[0]?.file).toBe('hello.rw');
    expect(examples[0]?.source.trim().split('\n')).toHaveLength(2);
    expect(examples[0]?.source).toContain('print("Hello, world!");');
  });

  it('keeps every guided lesson runnable', () => {
    for (const lesson of beginnerLessons) {
      const result = compile(lesson.code);
      expect(result.ok, `lesson ${lesson.number}: ${result.diagnostics.map((item) => item.message).join(', ')}`).toBe(true);
    }
  });

  it('introduces concepts in a gradual order', () => {
    expect(beginnerLessons[0]?.code).not.toContain('let(');
    expect(beginnerLessons[1]?.code).toContain('let(');
    expect(beginnerLessons[2]?.code).toContain('if(');
    expect(beginnerLessons[3]?.code).toContain('loop(');
    expect(beginnerLessons[4]?.code).toContain('class(');
  });
});
