export default `#version 300 es
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec2 uv;
layout(location = 3) in vec4 tangent;

uniform mat4 viewMat;
uniform mat4 projMat;
uniform mat4 worldMat;

out vec3 _normal;
out vec3 _pos;
out vec4 _tangent;
out vec2 _uv;

void main()
{
  _pos = position;
  _normal =  normal;
  _tangent = tangent;
  _uv = uv;

  gl_Position = projMat * viewMat * worldMat * vec4(position, 1.0f);
}
`;