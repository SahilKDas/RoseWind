export interface BeginnerLesson {
  readonly number: number;
  readonly title: string;
  readonly idea: string;
  readonly explanation: string;
  readonly code: string;
  readonly result: readonly string[];
  readonly challenge: string;
}

export const beginnerLessons: readonly BeginnerLesson[] = [
  {
    number: 1,
    title: 'Make the computer talk',
    idea: 'A program is a list of instructions. RoseWind reads them from top to bottom.',
    explanation: 'print shows text in the Output box. Text lives between quotation marks, and the semicolon marks the end of the instruction.',
    code: `print("Hello, world!");
print("I wrote my first program.");
`,
    result: ['Hello, world!', 'I wrote my first program.'],
    challenge: 'Change the message so the computer introduces you.',
  },
  {
    number: 2,
    title: 'Give information a name',
    idea: 'A variable is a labeled box where the computer remembers a value.',
    explanation: 'let creates the box. name is its label, text says what belongs inside, and = puts the first value into it.',
    code: `let(name:text = "Sky");
let(points:num = 7);

print("Hello, " + name + "!");
print("Points: " + str(points));
`,
    result: ['Hello, Sky!', 'Points: 7'],
    challenge: 'Change the name and add 3 to the score before printing it.',
  },
  {
    number: 3,
    title: 'Let the program decide',
    idea: 'A condition is a yes-or-no question the computer can answer.',
    explanation: 'if runs the first block when its question is true. Otherwise, else runs the other block. The braces group each possible path.',
    code: `let(coins:num = 12);

if(coins >= 10) {
    print("You can buy the cape!");
} else {
    print("Collect a few more coins.");
}
`,
    result: ['You can buy the cape!'],
    challenge: 'Try 4 coins, run again, and predict the new message first.',
  },
  {
    number: 4,
    title: 'Repeat without repeating yourself',
    idea: 'A loop asks the computer to repeat a block for each value in a list.',
    explanation: 'range(1, 6) makes the numbers 1 through 5. During each trip through the loop, round remembers the current number.',
    code: `loop(round:range(1, 6)) {
    print("Round " + str(round));
}

print("Blast off!");
`,
    result: ['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5', 'Blast off!'],
    challenge: 'Turn this into a countdown from a number you choose.',
  },
  {
    number: 5,
    title: 'Invent your own kind of thing',
    idea: 'A class is a recipe for creating objects that keep data and know how to act.',
    explanation: 'Pet is the recipe. create fills in a new pet, self means this pet, and speak is an action every Pet can perform.',
    code: `class(Pet) {
    pub(name:text);

    create(name:text) {
        self.name = name;
    }

    pub(speak()->void) {
        print("Hi, I am " + self.name + "!");
    }
}

let(myPet:Pet = new(Pet, "Pixel"));
myPet.speak();
`,
    result: ['Hi, I am Pixel!'],
    challenge: 'Add a sound field and make your pet say its sound.',
  },
  {
    number: 6,
    title: 'Build something that is yours',
    idea: 'Real programs combine small ideas. You already know enough to invent one.',
    explanation: 'This tiny game remembers a hero, repeats three turns, makes a choice, and reports the ending. Read it one block at a time.',
    code: `let(hero:text = "Nova");
let(score:num = 0);

loop(turn:range(1, 4)) {
    score = score + turn;
    print(hero + " finished turn " + str(turn));
}

if(score >= 6) {
    print("Quest complete! Score: " + str(score));
} else {
    print("Try the quest again.");
}
`,
    result: ['Nova finished turn 1', 'Nova finished turn 2', 'Nova finished turn 3', 'Quest complete! Score: 6'],
    challenge: 'Rename the hero, change the number of turns, and write your own ending.',
  },
];
