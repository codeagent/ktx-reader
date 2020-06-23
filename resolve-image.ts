export const resolveImage = async (path: string) => {
  return new Promise(async (r, j) => {
    const rs = await fetch(path);
    const blob = await rs.blob();
    const image = new Image();
    image.onload = () => r(image);
    image.onerror = j;
    image.src = URL.createObjectURL(blob);
  });
};
