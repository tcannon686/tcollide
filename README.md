# tcollide
tcollide is a simple 3D collision detection library for three.js that uses the
GJK and EPA algorithms. It also features very rudimentary physics. At the
moment, the physics simulation is only suitable for very simple projects (and in
all honesty should probably not even be considered a physics engine), but who
knows, maybe it would be useful for some people.

## Usage
First, install the package using `npm add tcollide`. Next, you will want to
create a scene using the `scene({})` factory method, which creates a scene with
the given properties. After you have created a scene object, you can add bodies
to it using the `.add(body)` method. Bodies can be created using the `body({
supports })` factory method. This method creates a body, which in tcollide is
simply a transformable collection of collision shapes.

Since tcollide uses the GJK algorithm, collision shapes are defined using
special _support functions_. A support function is simply a function `f(d)` that
returns the point on the shape with the highest dot product with the given
vector `d`. For this reason, shapes are referred to as supports. In tcollide,
rather than return a new vector, the passed in vector `d` is modified in place.
If you would like to write your own support function, set the return value by
using `d.set(x, y, z)`, or some other method from three.js's Vector3 class. A
variety of shapes are included, including `sphere({})`, `box({})`, and
`circle({})`, as well as some utility functions for combining shapes together.
Most of the factory methods for the basic support functions take a properties
object as an argument. For example, to create a circle of radius 3, you can use
`circle({ radius: 3 })`. Pass an empty object if you want to use the default
values.

In addition to basic shapes, tcollide also includes some options for combining
shapes. Note that the result of these operations is always another convex shape.
On example is the `hull(...supports)` method, which combines support functions
by running each of them on the given vector, and then returning the result with
the highest dot product. There is also the `sum(...supports)` function, which
simply adds the result of each support together. These operators along with the
basic shapes can be used together to create some interesting new shapes. For
example, a capsule can be created by using `hull(sphere({}), sphere({ position:
[0, 1, 0] })`. You could also create a rounded box by using `sum(sphere({}),
box({}))`.

For more details, you can read the documentation, generated using jsdoc,
available [here](https://tcannon686.github.io/tcollide). To build the docs, run
`yarn makedocs`. They have details about each function, and are located in the
docs folder.

## API reference
Please see <https://tcannon686.github.io/tcollide>
