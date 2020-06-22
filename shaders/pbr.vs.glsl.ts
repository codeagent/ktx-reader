export default `#version 300 es
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;

uniform mat4 viewMat;
uniform mat4 projMat;
uniform mat4 worldMat;

out vec3 _normal;
out vec3 _pos;

void main()
{
  _pos = position;
  _normal =  normal;
  gl_Position = projMat * viewMat * worldMat * vec4(position, 1.0f);
}
`;