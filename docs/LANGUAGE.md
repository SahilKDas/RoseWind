# RoseWind language guide

## v0.3: start simple, stay strongly typed

RoseWind ignores every whitespace character outside text, regex, and block-comment literals. Spaces, tabs, and newlines are decoration: readable and minified programs produce the same syntax tree and behavior. Even `l e t(score=42);` is valid and normalizes to `let(score=42);`.

Start with inferred variables:

```rosewind
let(name = "River");
let(score = 42);
let(values = [1, 2, 3]);
```

RoseWind learns each variable's type from its first value and still prevents unsafe changes. Add an explicit type when the value does not make the intent clear or when a nullable/collection contract matters:

```rosewind
let(nickname:text? = null);
let(values:list<num> = [1, 2, 3]);
let(record:dict<text, any> = { name: "RoseWind", stable: true });
```

Primitive types are `text`, `num`, `bool`, `void`, and `any`. Web data types are `date`, `time`, `bytes`, `decimal`, `id`, `set<T>`, and `regex`. A trailing `?` makes a type nullable. Duration literals support `ms`, `s`, `m`, `h`, and `d`; regex literals use `r"pattern"`.

## Classes

A field or method is public by default. Use `priv(...)` only for details that the object should keep to itself. Methods that return nothing do not need `->void`.

```rosewind
class(Pet) {
    name: text;
    priv(age: num);

    create(name: text, age: num) {
        self.name = name;
        self.age = age;
    }

    speak() {
        print("Hi, I am " + self.name + "!");
    }
}

let(pet = new(Pet, "Buddy", 3));
pet.speak();
```

`create` is the explicit constructor and `self` means the current object, keeping RoseWind's Python-inspired object model visible. Inheritance uses `class(Child:Parent)`, and parent behavior is available through `super`. For methods that return a value, write an explicit result type:

```rosewind
score()->num {
    return(10);
}
```

The older explicit wrappers, such as `pub(name:type);`, remain valid v0.2 source, but new code normally uses the shorter public-by-default form.

## Control flow

```rosewind
loop(item:range(0, 10)) {
    if(item == 5) { continue; }
    if(item > 7) { break; }
}

match(status) {
    case("ready") { print("Go"); }
    default { print("Wait"); }
}

try {
    print(parseJSON(payload));
} catch(error) {
    print(str(error));
}
```

`if`, `loop`, and `match` headers always use parentheses. Iteration uses `loop(item:values)`. Returns use `return(value);` or `return();`.

## Comments

Comments use punctuation-delimited `/* ... */`. RoseWind does not accept line comments because their ending would make a newline meaningful. Whitespace inside `"text"`, `'text'`, `r"regex"`, and `/* block comments */` is preserved.

## Compilation and running

RoseWind parses and type-checks the program first, then emits JavaScript for just-in-time execution in the browser worker or command-line runner. A type error stops execution before unsafe JavaScript is produced.

## Standard library

| Function | Result |
| --- | --- |
| `print(...values)` | Writes to the Studio or CLI output |
| `input(prompt)` | Reads text input |
| `len(value)` | Counts text or collection items |
| `range(start, end, step)` | Creates a number list |
| `str(value)`, `num(value)` | Performs safe primitive casts |
| `toJSON(value)`, `parseJSON(text)` | Converts JSON data |
| `wait(duration)` | Pauses without blocking |
| `web.fetch(...)` | Makes a web request |
| `math.random()` | Returns a random number in [0, 1) |
| `typeOf(value)` | Returns the runtime type name |

Typed constructors include `date()`, `bytes()`, `decimal()`, `id()`, and `set()`.

## Grammar summary

Statements end with semicolons and blocks use braces. The main declaration forms are `class(Name)`, `let(name=value);`, `name:type;`, `method(parameters) { ... }`, and `priv(member)`. Object creation uses `new(Class, arguments)`. Match arms use `case(value) { ... }` and `default { ... }`. Use Studio's **Minify** command to see that whitespace does not affect compilation.