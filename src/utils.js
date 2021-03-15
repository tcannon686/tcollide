export function randomizeDirection (d) {
  do {
    d.set(
      Math.random() - Math.random(),
      Math.random() - Math.random(),
      Math.random() - Math.random()
    )
  } while (d.lengthSq() === 0)
  d.normalize()
}
