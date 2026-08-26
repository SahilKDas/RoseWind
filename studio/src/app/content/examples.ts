export interface CodeExample {
  readonly name: string;
  readonly file: string;
  readonly stage: string;
  readonly description: string;
  readonly source: string;
}

export const examples: readonly CodeExample[] = [
  {
    name: 'Hello, computer', file: 'hello.rw', stage: '01',
    description: 'Make the computer say something',
    source: `print("Hello, world!");
print("I made this with RoseWind.");
`,
  },
  {
    name: 'Names & values', file: 'variables.rw', stage: '02',
    description: 'Teach the computer to remember',
    source: `let(name:text = "River");
let(age:num = 10);

print("Hi, " + name + "!");
print("Next year you will be " + str(age + 1) + ".");
`,
  },
  {
    name: 'Make a choice', file: 'choices.rw', stage: '03',
    description: 'Run code only when something is true',
    source: `let(score:num = 8);

if(score >= 10) {
    print("You unlocked the next level!");
} else {
    print("Keep going — you are close!");
}
`,
  },
  {
    name: 'Repeat things', file: 'loops.rw', stage: '04',
    description: 'Let the computer do the boring repetition',
    source: `loop(round:range(1, 6)) {
    print("Round " + str(round));
}

print("Blast off!");
`,
  },
  {
    name: 'Build a pet', file: 'pet.rw', stage: '05',
    description: 'Combine data and actions into your own object',
    source: `/* You are ready for classes! */
class(Pet) {
    pub(name:text);
    priv(age:num);

    create(name:text, age:num) {
        self.name = name;
        self.age = age;
    }

    pub(speak()->void) {
        print("Hi, I am " + self.name + "!");
    }
}

let(myDog:Pet = new(Pet, "Buddy", 3));
myDog.speak();
`,
  },
  {
    name: 'Patterns', file: 'patterns.rw', stage: '06',
    description: 'Handle several possible answers clearly',
    source: `let(total:num = 0);

loop(item:range(1, 6)) {
    total = total + item;
}

match(total) {
    case(15) {
        print("The total is fifteen.");
    }
    default {
        print("Total: " + str(total));
    }
}
`,
  },
  {
    name: 'Web data', file: 'data.rw', stage: '07',
    description: 'Work with lists, records, and JSON',
    source: `let(tags:set<text> = set(["typed", "web", "friendly"]));
let(payload:dict<text, any> = {
    name: "RoseWind",
    stable: true,
    score: 1
});

let(encoded:text = toJSON(payload));
print(encoded);
print("Unique tags: " + str(len(tags)));
print("Run id: " + str(id()));
`,
  },
];