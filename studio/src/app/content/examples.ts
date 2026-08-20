export interface CodeExample { readonly name: string; readonly file: string; readonly source: string; }

export const examples: readonly CodeExample[] = [
  {
    name: 'Pet class', file: 'pet.rw', source: `// RoseWind: a modern type-safe language for beginners
class Pet {
    pub text name;
    priv num age;

    create(text name, num age) {
        self.name = name;
        self.age = age;
    }

    pub speak() -> void {
        print("Hi, I am " + self.name + "!");
    }
}

let myDog: Pet = new Pet("Buddy", 3);
myDog.speak();
`,
  },
  {
    name: 'Loops & match', file: 'loops.rw', source: `let total: num = 0;

loop item in range(1, 6) {
    total = total + item;
}

match (total) {
    case 15 => {
        print("The total is fifteen.");
    }
    default => {
        print("Total: " + str(total));
    }
}
`,
  },
  {
    name: 'Web data', file: 'data.rw', source: `let tags: set<text> = set(["typed", "web", "friendly"]);
let payload: dict<text, any> = {
    name: "RoseWind",
    stable: true,
    score: 1
};

let encoded: text = toJSON(payload);
print(encoded);
print("Unique tags: " + str(len(tags)));
print("Run id: " + str(id()));
`,
  },
];
