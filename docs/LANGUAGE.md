# RoseWind language guide

## Declarations and types

```rosewind
let score: num = 42;
let nickname: text? = null;
let values: list<num> = [1, 2, 3];
let record: dict<text, any> = { name: "RoseWind", stable: true };
let tags: set<text> = set(["typed", "friendly"]);
```

Primitive types are `text`, `num`, `bool`, `void`, and `any`. Web data types are `date`, `time`, `bytes`, `decimal`, `id`, `set<T>`, and `regex`. A trailing `?` makes any type nullable.

Duration literals support `ms`, `s`, `m`, `h`, and `d`. Regex literals use `r"pattern"`.

## Classes

```rosewind
class Pet {
    pub text name;
    priv num age;

    create(text name, num age) {
        self.name = name;
        self.age = age;
    }

    pub speak() -> void {
        print("Hi, I am " + self.name);
    }
}

let pet: Pet = new Pet("Buddy", 3);
pet.speak();
```

Classes support `extends`, `super`, public and private members, typed parameters, and typed returns.

## Control flow

```rosewind
loop item in range(0, 10) {
    if (item == 5) { continue; }
    if (item > 7) { break; }
}

match (status) {
    case "ready" => { print("Go"); }
    default => { print("Wait"); }
}

try {
    print(parseJSON(payload));
} catch (error) {
    print(str(error));
}
```

## Standard library

| Function | Result |
| --- | --- |
| `print(...values)` | Writes to the studio or CLI output |
| `input(prompt)` | Asynchronous text input (empty in the non-interactive CLI) |
| `len(value)` | Collection, dictionary, or text length |
| `range(start, end, step)` | Number list |
| `str(value)`, `num(value)` | Safe primitive casts |
| `toJSON(value)`, `parseJSON(text)` | JSON conversion |
| `wait(duration)` | Non-blocking delay |
| `web.fetch(...)` | Fetch API access |
| `math.random()` | Random number in [0, 1) |
| `typeOf(value)` | Runtime type name |

Typed constructors include `date()`, `bytes()`, `decimal()`, `id()`, and `set()`.

## Current grammar

Statements end with semicolons. Blocks use braces. Conditions may be parenthesized. Unified loops support `loop item in iterable`, `loop condition`, and `loop { ... }`. Match arms use `case value => { ... }` and `default => { ... }`.
