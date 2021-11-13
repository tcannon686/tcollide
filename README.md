# tcollide
tcollide is a simple 3D collision detection library for three.js that uses the
GJK and EPA algorithms. The current physics model is very simple, something
along the lines of:
```javascript
if (objectsAreColliding()) {
  dont()
}
```
Nonetheless, maybe it will be useful for some people.

## Usage
Install it using `npm install tcollide`

### Creating shapes
Shapes in tcollide are called "supports". A support is a function that given a
direction `d` returns the point on the shape with the highest dot product with
`d`.

Supports can be created using several factory methods. Most methods take an
object with the desired properties as an argument. Here are some examples:
```javascript
import { sphere, box } from 'tcollide'
const myCircle = sphere({ position: [0, 1, 2], radius: 3 })
const myDefaultCircle = sphere({})
const myBox = box({ position: [1, 2, 3], size: [3, 2, 1] })
```

In addition to basic shapes, tcollide also includes some options for combining
shapes. Note that the result of these operations is always another convex shape.
On example is the `hull(...supports)` method, which combines support functions
by running each of them on the given vector, and then returning the result with
the highest dot product. `hull` can be used to create a capsule by combining two
spheres:
```javascript
import { sphere, hull } from 'tcollide'
const myCapsule = hull(
  sphere({ position: [0, 1, 0] }),
  sphere({})
)
```

There is also the `sum(...supports)` function, which simply adds the result of
each support together. This could be used to create cool shapes like a rounded
box:
```javascript
import { sphere, box, sum } from 'tcollide'
const myRoundedBox = sum(sphere({}), box({}))
```

### Creating bodies
A body is a collection of supports that move together. Bodies can be transformed
and moved around. Bodies are created using the `body` factory method:
```javascript
import { body, sphere } from 'tcollide'
const myBody = body({ supports: [sphere({})], isKinematic: true })
```

Once you have created a body, you can move it around as much as you like by
changing `Body.transform`, which is a Matrix4 from three.js. Just make sure to
call `Body.update()` after!
```javascript
myBody.transform.setPosition(1, 2, 3)
myBody.update()
```

If you want, you can subscribe to changes in the body's position. To do so, use
the `changed(body)` function. This function returns an RxJS observable. Here is
an example:
```javascript
import { changed } from 'tcollide'
changed(myBody).subscribe(() => {
  console.log(myBody.position)
})
```

### Creating scenes
A scene is a collection of bodies. To create a scene and add bodies to it, do
this:
```javascript
import { scene } from 'tcollide'
const myScene = scene({})
myScene.add(myBody)
```

To increment the physics simulation, run `Scene.update(dt)`, where dt is the
elapsed time in seconds. This will trigger changes in all of the bodies. If you
subscribed to the changes using `changed(body)`, this callback will be run!

## API reference
Please see <https://tcannon686.github.io/tcollide> for the complete API
reference.
