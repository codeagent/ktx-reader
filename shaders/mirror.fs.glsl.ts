export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec3 _normal;
in vec3 _pos;

uniform samplerCube env;
uniform vec3 pos;

void main()
{
  vec3 v = normalize(_pos - pos);
  vec3 r = reflect(v, _normal);
  color = vec4(1.0f, 0.0f, 0.0f, 1.0f); //vec4(texture(env, r).rgb, 1.0f);
}
`;