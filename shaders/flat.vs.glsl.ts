export default `#version 300 es
layout(location = 0) in vec3 position;
layout(location = 2) in vec2 uv;

uniform mat4 viewMat;
uniform mat4 projMat;
uniform mat4 worldMat;

out vec2 _uv;

void main()
{
  _uv = vec2(uv.x, 1.0f - uv.y);
  gl_Position = projMat * viewMat * worldMat * vec4(position, 1.0f);
}
`;